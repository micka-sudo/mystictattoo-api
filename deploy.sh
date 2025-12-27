#!/bin/bash

#===============================================================================
# MYSTIC TATTOO - Script de déploiement automatisé
#===============================================================================
# Workflow: release/X.X.X → staging → main
#
# Usage:
#   ./deploy.sh                    # Déploiement interactif
#   ./deploy.sh patch              # Bump patch (1.2.3 → 1.2.4)
#   ./deploy.sh minor              # Bump minor (1.2.3 → 1.3.0)
#   ./deploy.sh major              # Bump major (1.2.3 → 2.0.0)
#   ./deploy.sh --help             # Aide
#
# Prérequis: git, gh (GitHub CLI), node, npm
#===============================================================================

set -e  # Arrêter en cas d'erreur

#-------------------------------------------------------------------------------
# Configuration
#-------------------------------------------------------------------------------
FRONTEND_DIR="../mystictattoo"
BACKEND_DIR="."
MAIN_BRANCH="main"
STAGING_BRANCH="staging"
REMOTE="origin"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

#-------------------------------------------------------------------------------
# Fonctions utilitaires
#-------------------------------------------------------------------------------
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }
log_step() { echo -e "\n${CYAN}▶${NC} ${CYAN}$1${NC}"; }

confirm() {
    read -p "$(echo -e ${YELLOW}"$1 [y/N]: "${NC})" response
    [[ "$response" =~ ^[Yy]$ ]]
}

#-------------------------------------------------------------------------------
# Vérification des prérequis
#-------------------------------------------------------------------------------
check_prerequisites() {
    log_step "Vérification des prérequis"

    local missing=()

    command -v git >/dev/null 2>&1 || missing+=("git")
    command -v gh >/dev/null 2>&1 || missing+=("gh (GitHub CLI)")
    command -v node >/dev/null 2>&1 || missing+=("node")
    command -v npm >/dev/null 2>&1 || missing+=("npm")

    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Prérequis manquants: ${missing[*]}"
        exit 1
    fi

    # Vérifier l'authentification GitHub
    if ! gh auth status >/dev/null 2>&1; then
        log_error "GitHub CLI non authentifié. Exécutez: gh auth login"
        exit 1
    fi

    log_success "Tous les prérequis sont satisfaits"
}

#-------------------------------------------------------------------------------
# Obtenir la version actuelle depuis package.json
#-------------------------------------------------------------------------------
get_current_version() {
    node -p "require('./package.json').version" 2>/dev/null || echo "0.0.0"
}

#-------------------------------------------------------------------------------
# Calculer la nouvelle version
#-------------------------------------------------------------------------------
bump_version() {
    local current=$1
    local type=$2

    IFS='.' read -r major minor patch <<< "$current"

    case $type in
        major) echo "$((major + 1)).0.0" ;;
        minor) echo "${major}.$((minor + 1)).0" ;;
        patch) echo "${major}.${minor}.$((patch + 1))" ;;
        *) echo "$current" ;;
    esac
}

#-------------------------------------------------------------------------------
# Mettre à jour la version dans package.json
#-------------------------------------------------------------------------------
update_package_version() {
    local new_version=$1
    local dir=$2

    if [ -f "$dir/package.json" ]; then
        # Utiliser node pour modifier proprement le JSON
        node -e "
            const fs = require('fs');
            const pkg = require('$dir/package.json');
            pkg.version = '$new_version';
            fs.writeFileSync('$dir/package.json', JSON.stringify(pkg, null, 2) + '\n');
        "
        log_success "Version mise à jour: $new_version dans $dir/package.json"
    fi
}

#-------------------------------------------------------------------------------
# Vérifier l'état du repo
#-------------------------------------------------------------------------------
check_git_status() {
    log_step "Vérification de l'état Git"

    # Vérifier les changements non commités
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        log_warning "Changements non commités détectés"
        git status --short
        if ! confirm "Voulez-vous les stasher temporairement?"; then
            log_error "Annulation - commitez ou stashez vos changements d'abord"
            exit 1
        fi
        git stash push -m "deploy-script-autostash"
        STASHED=true
    fi

    # Mettre à jour les refs distantes
    git fetch --all --prune
    log_success "Repository synchronisé"
}

#-------------------------------------------------------------------------------
# Obtenir la branche release actuelle
#-------------------------------------------------------------------------------
get_current_release_branch() {
    git branch --list 'release/*' | head -1 | sed 's/^[* ]*//'
}

#-------------------------------------------------------------------------------
# Créer ou basculer vers la branche release
#-------------------------------------------------------------------------------
setup_release_branch() {
    local version=$1
    local branch="release/$version"

    log_step "Configuration de la branche release"

    # Vérifier si la branche existe
    if git show-ref --verify --quiet "refs/heads/$branch"; then
        git checkout "$branch"
        log_success "Basculé vers $branch"
    else
        # Créer depuis staging ou main
        local base_branch="$STAGING_BRANCH"
        if ! git show-ref --verify --quiet "refs/heads/$STAGING_BRANCH"; then
            base_branch="$MAIN_BRANCH"
        fi

        git checkout "$base_branch"
        git pull "$REMOTE" "$base_branch" --rebase
        git checkout -b "$branch"
        log_success "Branche $branch créée depuis $base_branch"
    fi

    echo "$branch"
}

#-------------------------------------------------------------------------------
# Build et test du backend
#-------------------------------------------------------------------------------
deploy_backend() {
    log_step "Déploiement Backend"

    cd "$BACKEND_DIR"

    # Installer les dépendances
    log_info "Installation des dépendances..."
    npm ci --silent 2>/dev/null || npm install --silent

    # Vérifier la syntaxe
    log_info "Vérification de la syntaxe..."
    for file in index.js routes/*.js models/*.js services/*.js middlewares/*.js; do
        if [ -f "$file" ]; then
            node -c "$file" >/dev/null 2>&1 || {
                log_error "Erreur de syntaxe dans $file"
                exit 1
            }
        fi
    done

    # Lancer les tests si disponibles
    if grep -q '"test"' package.json && ! grep -q '"test": "echo' package.json; then
        log_info "Exécution des tests..."
        npm test || {
            log_error "Tests échoués"
            exit 1
        }
    fi

    log_success "Backend validé"
}

#-------------------------------------------------------------------------------
# Build et test du frontend
#-------------------------------------------------------------------------------
deploy_frontend() {
    log_step "Déploiement Frontend"

    if [ ! -d "$FRONTEND_DIR" ]; then
        log_warning "Dossier frontend non trouvé: $FRONTEND_DIR"
        return 0
    fi

    cd "$FRONTEND_DIR"

    # Installer les dépendances
    log_info "Installation des dépendances..."
    npm ci --silent 2>/dev/null || npm install --silent

    # Build de production
    log_info "Build de production..."
    npm run build || {
        log_error "Build frontend échoué"
        exit 1
    }

    log_success "Frontend buildé"

    cd - >/dev/null
}

#-------------------------------------------------------------------------------
# Créer une PR
#-------------------------------------------------------------------------------
create_pr() {
    local source=$1
    local target=$2
    local title=$3
    local body=$4

    log_info "Création PR: $source → $target"

    # Pousser la branche source
    git push "$REMOTE" "$source" -u

    # Vérifier si une PR existe déjà
    local existing_pr=$(gh pr list --head "$source" --base "$target" --json number --jq '.[0].number' 2>/dev/null)

    if [ -n "$existing_pr" ]; then
        log_warning "PR #$existing_pr existe déjà"
        echo "$existing_pr"
        return
    fi

    # Créer la PR
    local pr_url=$(gh pr create \
        --base "$target" \
        --head "$source" \
        --title "$title" \
        --body "$body" \
        2>/dev/null)

    local pr_number=$(echo "$pr_url" | grep -oE '[0-9]+$')
    log_success "PR #$pr_number créée: $pr_url"
    echo "$pr_number"
}

#-------------------------------------------------------------------------------
# Merger une PR
#-------------------------------------------------------------------------------
merge_pr() {
    local pr_number=$1
    local merge_method=${2:-"squash"}  # squash, merge, rebase

    log_info "Merge de la PR #$pr_number..."

    gh pr merge "$pr_number" --"$merge_method" --delete-branch || {
        log_error "Échec du merge PR #$pr_number"
        return 1
    }

    log_success "PR #$pr_number mergée"
}

#-------------------------------------------------------------------------------
# Créer un tag et une release GitHub
#-------------------------------------------------------------------------------
create_release() {
    local version=$1
    local tag="v$version"

    log_step "Création de la release $tag"

    # S'assurer d'être sur main à jour
    git checkout "$MAIN_BRANCH"
    git pull "$REMOTE" "$MAIN_BRANCH"

    # Vérifier si le tag existe
    if git rev-parse "$tag" >/dev/null 2>&1; then
        log_warning "Tag $tag existe déjà"
        return 0
    fi

    # Créer le tag
    git tag -a "$tag" -m "Release $version"
    git push "$REMOTE" "$tag"

    # Générer les notes de release
    local previous_tag=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
    local release_notes=""

    if [ -n "$previous_tag" ]; then
        release_notes=$(git log "$previous_tag"..HEAD --pretty=format:"- %s" --no-merges)
    else
        release_notes="Initial release"
    fi

    # Créer la release GitHub
    gh release create "$tag" \
        --title "Release $version" \
        --notes "$release_notes" \
        --latest

    log_success "Release $tag créée"
}

#-------------------------------------------------------------------------------
# Nettoyer les branches release obsolètes
#-------------------------------------------------------------------------------
cleanup_release_branches() {
    log_step "Nettoyage des branches release"

    # Lister les branches release locales
    local branches=$(git branch --list 'release/*' | sed 's/^[* ]*//')

    for branch in $branches; do
        # Vérifier si la branche a été mergée dans main
        if git branch --merged "$MAIN_BRANCH" | grep -q "$branch"; then
            log_info "Suppression de $branch (mergée)"
            git branch -d "$branch" 2>/dev/null || true
            git push "$REMOTE" --delete "$branch" 2>/dev/null || true
        fi
    done

    log_success "Nettoyage terminé"
}

#-------------------------------------------------------------------------------
# Workflow principal
#-------------------------------------------------------------------------------
main() {
    local bump_type="${1:-}"

    # Aide
    if [ "$bump_type" == "--help" ] || [ "$bump_type" == "-h" ]; then
        echo "Usage: $0 [patch|minor|major]"
        echo ""
        echo "Options:"
        echo "  patch    Incrémente la version patch (1.2.3 → 1.2.4)"
        echo "  minor    Incrémente la version minor (1.2.3 → 1.3.0)"
        echo "  major    Incrémente la version major (1.2.3 → 2.0.0)"
        echo "  --help   Affiche cette aide"
        exit 0
    fi

    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║       MYSTIC TATTOO - Déploiement Automatisé              ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    STASHED=false

    # Étape 1: Prérequis
    check_prerequisites
    check_git_status

    # Étape 2: Déterminer la version
    local current_version=$(get_current_version)
    log_info "Version actuelle: $current_version"

    if [ -z "$bump_type" ]; then
        echo ""
        echo "Type de release:"
        echo "  1) patch ($current_version → $(bump_version $current_version patch))"
        echo "  2) minor ($current_version → $(bump_version $current_version minor))"
        echo "  3) major ($current_version → $(bump_version $current_version major))"
        read -p "Choix [1]: " choice
        case ${choice:-1} in
            1) bump_type="patch" ;;
            2) bump_type="minor" ;;
            3) bump_type="major" ;;
            *) bump_type="patch" ;;
        esac
    fi

    local new_version=$(bump_version "$current_version" "$bump_type")
    log_success "Nouvelle version: $new_version"

    if ! confirm "Continuer avec la version $new_version?"; then
        log_warning "Annulation"
        exit 0
    fi

    # Étape 3: Configurer la branche release
    local release_branch=$(setup_release_branch "$new_version")

    # Étape 4: Mettre à jour les versions
    log_step "Mise à jour des versions"
    update_package_version "$new_version" "$BACKEND_DIR"
    if [ -d "$FRONTEND_DIR" ]; then
        update_package_version "$new_version" "$FRONTEND_DIR"
    fi

    # Commit des changements de version
    git add -A
    if ! git diff --cached --quiet; then
        git commit -m "chore: bump version to $new_version"
    fi

    # Étape 5: Build et tests
    deploy_backend
    deploy_frontend

    # Étape 6: Push de la branche release
    log_step "Push de la branche release"
    git push "$REMOTE" "$release_branch" -u

    # Étape 7: PR release → staging
    log_step "Création PR release → staging"

    # Créer staging si n'existe pas
    if ! git show-ref --verify --quiet "refs/remotes/$REMOTE/$STAGING_BRANCH"; then
        log_info "Création de la branche staging..."
        git checkout "$MAIN_BRANCH"
        git checkout -b "$STAGING_BRANCH"
        git push "$REMOTE" "$STAGING_BRANCH" -u
        git checkout "$release_branch"
    fi

    local pr_staging=$(create_pr "$release_branch" "$STAGING_BRANCH" \
        "Release $new_version → Staging" \
        "## Release $new_version

### Changements
- Bump version to $new_version
- Backend validé
- Frontend buildé

### Checklist
- [ ] Tests passés
- [ ] Review effectuée
- [ ] Prêt pour staging")

    echo ""
    if confirm "Merger la PR #$pr_staging dans staging?"; then
        merge_pr "$pr_staging" "squash"

        # Mettre à jour staging local
        git checkout "$STAGING_BRANCH"
        git pull "$REMOTE" "$STAGING_BRANCH"

        # Étape 8: PR staging → main
        log_step "Création PR staging → main"

        local pr_main=$(create_pr "$STAGING_BRANCH" "$MAIN_BRANCH" \
            "Release $new_version → Production" \
            "## Release $new_version - Production

### Déploiement validé sur staging
- Backend: ✅
- Frontend: ✅

### Checklist
- [ ] Tests staging validés
- [ ] Validation métier effectuée
- [ ] Prêt pour production")

        echo ""
        log_warning "⚠️  ATTENTION: Vous êtes sur le point de déployer en production!"
        echo ""

        if confirm "Merger la PR #$pr_main dans main (PRODUCTION)?"; then
            merge_pr "$pr_main" "squash"

            # Étape 9: Créer la release
            create_release "$new_version"

            # Étape 10: Nettoyer
            cleanup_release_branches

            echo ""
            echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
            echo -e "${GREEN}║                    DÉPLOIEMENT RÉUSSI!                     ║${NC}"
            echo -e "${GREEN}╠════════════════════════════════════════════════════════════╣${NC}"
            echo -e "${GREEN}║  Version: $new_version                                          ║${NC}"
            echo -e "${GREEN}║  Tag: v$new_version                                             ║${NC}"
            echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
        else
            log_info "PR #$pr_main créée mais non mergée"
            log_info "Mergez manuellement quand prêt: gh pr merge $pr_main --squash"
        fi
    else
        log_info "PR #$pr_staging créée mais non mergée"
        log_info "Mergez manuellement quand prêt: gh pr merge $pr_staging --squash"
    fi

    # Restaurer le stash si nécessaire
    if [ "$STASHED" = true ]; then
        log_info "Restauration du stash..."
        git stash pop
    fi

    echo ""
    log_success "Script terminé"
}

#-------------------------------------------------------------------------------
# Exécution
#-------------------------------------------------------------------------------
main "$@"
