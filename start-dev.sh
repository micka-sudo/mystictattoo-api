#!/bin/bash

#===============================================================================
# MYSTIC TATTOO - Lancement des serveurs de développement
#===============================================================================
# Usage:
#   ./start-dev.sh           # Lance backend + frontend
#   ./start-dev.sh backend   # Lance uniquement le backend
#   ./start-dev.sh frontend  # Lance uniquement le frontend
#   ./start-dev.sh stop      # Arrête tous les serveurs
#===============================================================================

set -e

#-------------------------------------------------------------------------------
# Configuration
#-------------------------------------------------------------------------------
BACKEND_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$(cd "$BACKEND_DIR/../mystictattoo" 2>/dev/null && pwd)" || FRONTEND_DIR=""
BACKEND_PORT=${BACKEND_PORT:-4000}
FRONTEND_PORT=${FRONTEND_PORT:-3000}

# Fichiers PID
PID_DIR="$BACKEND_DIR/.pids"
BACKEND_PID_FILE="$PID_DIR/backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend.pid"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

#-------------------------------------------------------------------------------
# Fonctions utilitaires
#-------------------------------------------------------------------------------
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# Créer le dossier PID
mkdir -p "$PID_DIR"

#-------------------------------------------------------------------------------
# Vérifier si un port est utilisé
#-------------------------------------------------------------------------------
is_port_in_use() {
    local port=$1
    if command -v lsof >/dev/null 2>&1; then
        lsof -i ":$port" >/dev/null 2>&1
    elif command -v netstat >/dev/null 2>&1; then
        netstat -an | grep -q ":$port.*LISTEN"
    else
        # Windows avec Git Bash
        netstat -ano 2>/dev/null | grep -q ":$port.*LISTENING"
    fi
}

#-------------------------------------------------------------------------------
# Tuer un processus par PID file
#-------------------------------------------------------------------------------
kill_by_pid_file() {
    local pid_file=$1
    local name=$2

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            log_info "Arrêt de $name (PID: $pid)..."
            kill "$pid" 2>/dev/null || true
            sleep 1
            # Force kill si toujours actif
            kill -9 "$pid" 2>/dev/null || true
            log_success "$name arrêté"
        fi
        rm -f "$pid_file"
    fi
}

#-------------------------------------------------------------------------------
# Tuer les processus sur un port
#-------------------------------------------------------------------------------
kill_port() {
    local port=$1

    if command -v lsof >/dev/null 2>&1; then
        local pids=$(lsof -t -i ":$port" 2>/dev/null)
        for pid in $pids; do
            kill "$pid" 2>/dev/null || true
        done
    elif command -v netstat >/dev/null 2>&1; then
        # Windows
        local pid=$(netstat -ano 2>/dev/null | grep ":$port.*LISTENING" | awk '{print $5}' | head -1)
        if [ -n "$pid" ]; then
            taskkill //PID "$pid" //F 2>/dev/null || true
        fi
    fi
}

#-------------------------------------------------------------------------------
# Arrêter tous les serveurs
#-------------------------------------------------------------------------------
stop_servers() {
    echo ""
    echo -e "${CYAN}Arrêt des serveurs...${NC}"
    echo ""

    kill_by_pid_file "$BACKEND_PID_FILE" "Backend"
    kill_by_pid_file "$FRONTEND_PID_FILE" "Frontend"

    # Libérer les ports si nécessaire
    if is_port_in_use $BACKEND_PORT; then
        log_info "Libération du port $BACKEND_PORT..."
        kill_port $BACKEND_PORT
    fi

    if is_port_in_use $FRONTEND_PORT; then
        log_info "Libération du port $FRONTEND_PORT..."
        kill_port $FRONTEND_PORT
    fi

    log_success "Tous les serveurs arrêtés"
}

#-------------------------------------------------------------------------------
# Lancer le backend
#-------------------------------------------------------------------------------
start_backend() {
    echo ""
    log_info "Démarrage du Backend sur le port $BACKEND_PORT..."

    cd "$BACKEND_DIR"

    # Vérifier si déjà en cours
    if [ -f "$BACKEND_PID_FILE" ] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
        log_warning "Backend déjà en cours (PID: $(cat "$BACKEND_PID_FILE"))"
        return 0
    fi

    # Vérifier le port
    if is_port_in_use $BACKEND_PORT; then
        log_warning "Port $BACKEND_PORT déjà utilisé, tentative de libération..."
        kill_port $BACKEND_PORT
        sleep 1
    fi

    # Installer les dépendances si nécessaire
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        log_info "Installation des dépendances..."
        npm install --silent
    fi

    # Lancer en arrière-plan
    if command -v nodemon >/dev/null 2>&1; then
        nodemon index.js > "$PID_DIR/backend.log" 2>&1 &
    else
        node index.js > "$PID_DIR/backend.log" 2>&1 &
    fi

    local pid=$!
    echo $pid > "$BACKEND_PID_FILE"

    # Attendre que le serveur démarre
    local max_wait=30
    local waited=0
    while ! is_port_in_use $BACKEND_PORT && [ $waited -lt $max_wait ]; do
        sleep 1
        waited=$((waited + 1))
    done

    if is_port_in_use $BACKEND_PORT; then
        log_success "Backend démarré sur http://localhost:$BACKEND_PORT (PID: $pid)"
    else
        log_error "Échec du démarrage du backend"
        cat "$PID_DIR/backend.log" 2>/dev/null | tail -20
        return 1
    fi
}

#-------------------------------------------------------------------------------
# Lancer le frontend
#-------------------------------------------------------------------------------
start_frontend() {
    if [ -z "$FRONTEND_DIR" ] || [ ! -d "$FRONTEND_DIR" ]; then
        log_warning "Dossier frontend non trouvé"
        return 0
    fi

    echo ""
    log_info "Démarrage du Frontend sur le port $FRONTEND_PORT..."

    cd "$FRONTEND_DIR"

    # Vérifier si déjà en cours
    if [ -f "$FRONTEND_PID_FILE" ] && kill -0 "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null; then
        log_warning "Frontend déjà en cours (PID: $(cat "$FRONTEND_PID_FILE"))"
        return 0
    fi

    # Vérifier le port
    if is_port_in_use $FRONTEND_PORT; then
        log_warning "Port $FRONTEND_PORT déjà utilisé, tentative de libération..."
        kill_port $FRONTEND_PORT
        sleep 1
    fi

    # Installer les dépendances si nécessaire
    if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules" ]; then
        log_info "Installation des dépendances..."
        npm install --silent
    fi

    # Lancer en arrière-plan
    npm start > "$PID_DIR/frontend.log" 2>&1 &
    local pid=$!
    echo $pid > "$FRONTEND_PID_FILE"

    # Attendre que le serveur démarre
    local max_wait=60
    local waited=0
    while ! is_port_in_use $FRONTEND_PORT && [ $waited -lt $max_wait ]; do
        sleep 1
        waited=$((waited + 1))
    done

    if is_port_in_use $FRONTEND_PORT; then
        log_success "Frontend démarré sur http://localhost:$FRONTEND_PORT (PID: $pid)"
    else
        log_error "Échec du démarrage du frontend"
        cat "$PID_DIR/frontend.log" 2>/dev/null | tail -20
        return 1
    fi

    cd "$BACKEND_DIR"
}

#-------------------------------------------------------------------------------
# Afficher le statut
#-------------------------------------------------------------------------------
show_status() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║         MYSTIC TATTOO - Status             ║${NC}"
    echo -e "${CYAN}╠════════════════════════════════════════════╣${NC}"

    # Backend
    if [ -f "$BACKEND_PID_FILE" ] && kill -0 "$(cat "$BACKEND_PID_FILE")" 2>/dev/null; then
        echo -e "${CYAN}║${NC} Backend:  ${GREEN}● Running${NC} (PID: $(cat "$BACKEND_PID_FILE"))       ${CYAN}║${NC}"
        echo -e "${CYAN}║${NC}           http://localhost:$BACKEND_PORT          ${CYAN}║${NC}"
    else
        echo -e "${CYAN}║${NC} Backend:  ${RED}○ Stopped${NC}                       ${CYAN}║${NC}"
    fi

    # Frontend
    if [ -f "$FRONTEND_PID_FILE" ] && kill -0 "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null; then
        echo -e "${CYAN}║${NC} Frontend: ${GREEN}● Running${NC} (PID: $(cat "$FRONTEND_PID_FILE"))       ${CYAN}║${NC}"
        echo -e "${CYAN}║${NC}           http://localhost:$FRONTEND_PORT          ${CYAN}║${NC}"
    else
        echo -e "${CYAN}║${NC} Frontend: ${RED}○ Stopped${NC}                       ${CYAN}║${NC}"
    fi

    # Swagger
    if is_port_in_use $BACKEND_PORT; then
        echo -e "${CYAN}║${NC} API Docs: http://localhost:$BACKEND_PORT/api-docs  ${CYAN}║${NC}"
    fi

    echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"
    echo ""
}

#-------------------------------------------------------------------------------
# Afficher les logs
#-------------------------------------------------------------------------------
show_logs() {
    local service=$1

    case $service in
        backend)
            if [ -f "$PID_DIR/backend.log" ]; then
                tail -f "$PID_DIR/backend.log"
            else
                log_error "Pas de logs backend"
            fi
            ;;
        frontend)
            if [ -f "$PID_DIR/frontend.log" ]; then
                tail -f "$PID_DIR/frontend.log"
            else
                log_error "Pas de logs frontend"
            fi
            ;;
        *)
            log_error "Usage: $0 logs [backend|frontend]"
            ;;
    esac
}

#-------------------------------------------------------------------------------
# Main
#-------------------------------------------------------------------------------
main() {
    local command="${1:-all}"

    case $command in
        backend)
            start_backend
            show_status
            ;;
        frontend)
            start_frontend
            show_status
            ;;
        stop)
            stop_servers
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "$2"
            ;;
        restart)
            stop_servers
            sleep 2
            start_backend
            start_frontend
            show_status
            ;;
        all|start)
            echo ""
            echo -e "${CYAN}╔════════════════════════════════════════════╗${NC}"
            echo -e "${CYAN}║    MYSTIC TATTOO - Serveurs de Dev         ║${NC}"
            echo -e "${CYAN}╚════════════════════════════════════════════╝${NC}"

            start_backend
            start_frontend
            show_status

            echo -e "${YELLOW}Commandes disponibles:${NC}"
            echo "  ./start-dev.sh stop     - Arrêter les serveurs"
            echo "  ./start-dev.sh status   - Voir le statut"
            echo "  ./start-dev.sh restart  - Redémarrer"
            echo "  ./start-dev.sh logs backend  - Voir les logs"
            echo ""
            ;;
        -h|--help)
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  all, start    Lancer backend + frontend (défaut)"
            echo "  backend       Lancer uniquement le backend"
            echo "  frontend      Lancer uniquement le frontend"
            echo "  stop          Arrêter tous les serveurs"
            echo "  restart       Redémarrer tous les serveurs"
            echo "  status        Afficher le statut"
            echo "  logs [service] Afficher les logs en temps réel"
            echo ""
            ;;
        *)
            log_error "Commande inconnue: $command"
            echo "Utilisez --help pour l'aide"
            exit 1
            ;;
    esac
}

main "$@"
