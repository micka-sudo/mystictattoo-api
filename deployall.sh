#!/bin/bash

#===============================================================================
# MYSTIC TATTOO - Script de deploiement complet (Frontend + Backend)
#===============================================================================
# Deploie le frontend (Vercel) puis le backend (Render) en une seule commande
#
# Usage:
#   ./deployall.sh                    # Deploiement interactif
#   ./deployall.sh patch              # Bump patch + deploy all
#   ./deployall.sh --frontend-only    # Deployer uniquement le frontend
#   ./deployall.sh --backend-only     # Deployer uniquement le backend
#   ./deployall.sh --status           # Verifier le statut des deployments
#   ./deployall.sh --help             # Aide
#
# Prerequis: git, gh (GitHub CLI), node, npm, vercel (optionnel)
#===============================================================================

set -e

#-------------------------------------------------------------------------------
# Configuration
#-------------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR"
FRONTEND_DIR="$SCRIPT_DIR/../mystictattoo-chat/mystictattoo-react"
MAIN_BRANCH="main"
REMOTE="origin"

# URLs de production
FRONTEND_URL="https://www.mystic-tattoo.fr"
BACKEND_URL="https://mystictattoo-api.onrender.com"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

#-------------------------------------------------------------------------------
# Fonctions utilitaires
#-------------------------------------------------------------------------------
log_info() { echo -e "${BLUE}i${NC} $1"; }
log_success() { echo -e "${GREEN}v${NC} $1"; }
log_warning() { echo -e "${YELLOW}!${NC} $1"; }
log_error() { echo -e "${RED}x${NC} $1"; }
log_step() { echo -e "\n${CYAN}>${NC} ${CYAN}$1${NC}"; }
log_header() { echo -e "\n${MAGENTA}=== $1 ===${NC}\n"; }

confirm() {
    read -p "$(echo -e ${YELLOW}"$1 [y/N]: "${NC})" response
    [[ "$response" =~ ^[Yy]$ ]]
}

#-------------------------------------------------------------------------------
# Verification des prerequis
#-------------------------------------------------------------------------------
check_prerequisites() {
    log_step "Verification des prerequis"

    local missing=()

    command -v git >/dev/null 2>&1 || missing+=("git")
    command -v node >/dev/null 2>&1 || missing+=("node")
    command -v npm >/dev/null 2>&1 || missing+=("npm")

    if [ ${#missing[@]} -ne 0 ]; then
        log_error "Prerequis manquants: ${missing[*]}"
        exit 1
    fi

    # Verifier si gh est disponible (optionnel)
    if command -v gh >/dev/null 2>&1; then
        HAS_GH=true
    else
        HAS_GH=false
        log_warning "GitHub CLI (gh) non installe - fonctionnalites limitees"
    fi

    log_success "Prerequis verifies"
}

#-------------------------------------------------------------------------------
# Verifier l'etat des services
#-------------------------------------------------------------------------------
check_status() {
    log_header "STATUT DES SERVICES"

    # Frontend
    log_step "Frontend ($FRONTEND_URL)"
    if curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" | grep -q "200\|301\|302"; then
        log_success "Frontend: En ligne"
    else
        log_error "Frontend: Hors ligne ou erreur"
    fi

    # Backend
    log_step "Backend ($BACKEND_URL)"
    local backend_health=$(curl -s "$BACKEND_URL/api/health" 2>/dev/null || echo "error")
    if echo "$backend_health" | grep -q "ok\|healthy"; then
        log_success "Backend: En ligne"
        echo "  $backend_health"
    else
        log_error "Backend: Hors ligne ou erreur"
    fi

    echo ""
}

#-------------------------------------------------------------------------------
# Deployer le Frontend
#-------------------------------------------------------------------------------
deploy_frontend() {
    log_header "DEPLOIEMENT FRONTEND"

    if [ ! -d "$FRONTEND_DIR" ]; then
        log_error "Dossier frontend non trouve: $FRONTEND_DIR"
        return 1
    fi

    cd "$FRONTEND_DIR"

    # Verifier Git
    if [ -d ".git" ] || [ -d "../.git" ] || [ -d "../../.git" ]; then
        log_info "Verification des changements Git..."

        # Trouver la racine du repo
        local git_root=$(git rev-parse --show-toplevel 2>/dev/null)
        cd "$git_root"

        # Verifier s'il y a des changements
        if ! git diff-index --quiet HEAD -- 2>/dev/null; then
            log_warning "Changements non commites detectes"
            git status --short

            if confirm "Commiter ces changements avant deploiement?"; then
                read -p "Message de commit: " commit_msg
                git add -A
                git commit -m "${commit_msg:-'Deploy frontend'}"
            fi
        fi

        # Push vers main
        log_info "Push vers $MAIN_BRANCH..."
        git push "$REMOTE" "$MAIN_BRANCH"
        log_success "Code pousse - deploiement Vercel declenche"
    fi

    # Build local pour verification
    log_step "Build de verification"
    cd "$FRONTEND_DIR"

    log_info "Installation des dependances..."
    npm ci --silent 2>/dev/null || npm install --silent

    log_info "Build de production..."
    npm run build || {
        log_error "Echec du build frontend"
        return 1
    }

    log_success "Frontend deploye avec succes"
    log_info "URL: $FRONTEND_URL"

    cd "$SCRIPT_DIR"
}

#-------------------------------------------------------------------------------
# Deployer le Backend
#-------------------------------------------------------------------------------
deploy_backend() {
    log_header "DEPLOIEMENT BACKEND"

    cd "$BACKEND_DIR"

    # Verifier Git
    log_info "Verification des changements Git..."

    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        log_warning "Changements non commites detectes"
        git status --short

        if confirm "Commiter ces changements avant deploiement?"; then
            read -p "Message de commit: " commit_msg
            git add -A
            git commit -m "${commit_msg:-'Deploy backend'}"
        fi
    fi

    # Validation
    log_step "Validation du code"

    log_info "Installation des dependances..."
    npm ci --silent 2>/dev/null || npm install --silent

    # TypeScript check si disponible
    if grep -q '"typecheck"' package.json 2>/dev/null; then
        log_info "Verification TypeScript..."
        npm run typecheck || {
            log_error "Erreurs TypeScript detectees"
            return 1
        }
    fi

    # Build si necessaire
    if grep -q '"build"' package.json 2>/dev/null; then
        log_info "Build..."
        npm run build || {
            log_error "Echec du build backend"
            return 1
        }
    fi

    # Push vers main
    log_step "Deploiement"
    log_info "Push vers $MAIN_BRANCH..."
    git push "$REMOTE" "$MAIN_BRANCH"

    log_success "Backend deploye avec succes"
    log_info "URL: $BACKEND_URL"
    log_info "Le deploiement Render peut prendre quelques minutes..."
}

#-------------------------------------------------------------------------------
# Deploiement complet
#-------------------------------------------------------------------------------
deploy_all() {
    local bump_type="${1:-}"

    echo ""
    echo -e "${CYAN}+============================================================+${NC}"
    echo -e "${CYAN}|       MYSTIC TATTOO - Deploiement Complet                 |${NC}"
    echo -e "${CYAN}+============================================================+${NC}"
    echo ""

    check_prerequisites

    # Version bump si specifie
    if [ -n "$bump_type" ] && [[ "$bump_type" =~ ^(patch|minor|major)$ ]]; then
        log_step "Bump de version: $bump_type"

        cd "$BACKEND_DIR"
        local current_version=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.0.0")

        # Calculer la nouvelle version
        IFS='.' read -r major minor patch <<< "$current_version"
        case $bump_type in
            major) new_version="$((major + 1)).0.0" ;;
            minor) new_version="${major}.$((minor + 1)).0" ;;
            patch) new_version="${major}.${minor}.$((patch + 1))" ;;
        esac

        log_info "Version: $current_version -> $new_version"

        # Mettre a jour les versions
        npm version "$new_version" --no-git-tag-version

        if [ -f "$FRONTEND_DIR/package.json" ]; then
            cd "$FRONTEND_DIR"
            npm version "$new_version" --no-git-tag-version
        fi

        cd "$BACKEND_DIR"
        git add -A
        git commit -m "chore: bump version to $new_version"
    fi

    # Deployer Frontend
    deploy_frontend

    echo ""

    # Deployer Backend
    deploy_backend

    echo ""
    echo -e "${GREEN}+============================================================+${NC}"
    echo -e "${GREEN}|              DEPLOIEMENT TERMINE AVEC SUCCES              |${NC}"
    echo -e "${GREEN}+============================================================+${NC}"
    echo ""
    echo -e "  ${CYAN}Frontend:${NC} $FRONTEND_URL"
    echo -e "  ${CYAN}Backend:${NC}  $BACKEND_URL"
    echo ""

    # Verification post-deploiement
    if confirm "Verifier le statut des services?"; then
        sleep 5  # Attendre un peu
        check_status
    fi
}

#-------------------------------------------------------------------------------
# Aide
#-------------------------------------------------------------------------------
show_help() {
    echo ""
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  (aucune)          Deploiement interactif complet"
    echo "  patch             Bump patch + deploiement complet"
    echo "  minor             Bump minor + deploiement complet"
    echo "  major             Bump major + deploiement complet"
    echo "  --frontend-only   Deployer uniquement le frontend"
    echo "  --backend-only    Deployer uniquement le backend"
    echo "  --status          Verifier le statut des services"
    echo "  --help, -h        Afficher cette aide"
    echo ""
    echo "Exemples:"
    echo "  $0                  # Deploiement interactif"
    echo "  $0 patch            # Nouvelle version patch + deploy"
    echo "  $0 --frontend-only  # Deployer uniquement le frontend"
    echo ""
}

#-------------------------------------------------------------------------------
# Point d'entree
#-------------------------------------------------------------------------------
main() {
    case "${1:-}" in
        --help|-h)
            show_help
            ;;
        --status)
            check_status
            ;;
        --frontend-only)
            check_prerequisites
            deploy_frontend
            ;;
        --backend-only)
            check_prerequisites
            deploy_backend
            ;;
        patch|minor|major)
            deploy_all "$1"
            ;;
        "")
            deploy_all
            ;;
        *)
            log_error "Option inconnue: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
