#!/usr/bin/env bash
#
# fellowship-service.sh — Start/stop The Fellowship as a background service.
#
# Usage:
#   fellowship-service.sh start   — Start all services (DB, backend, frontend, daemon)
#   fellowship-service.sh stop    — Stop all services
#   fellowship-service.sh status  — Show status of all services
#   fellowship-service.sh restart — Stop then start
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# --- Config ---
ENV_FILE="$REPO_ROOT/.env"
PID_DIR="$REPO_ROOT/.pids"
LOG_DIR="$REPO_ROOT/.logs"
mkdir -p "$PID_DIR" "$LOG_DIR"

# Load env
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

PORT="${PORT:-8080}"
FRONTEND_PORT="${FRONTEND_PORT:-3000}"

# --- Helpers ---
is_running() {
  local pidfile="$PID_DIR/$1.pid"
  if [ -f "$pidfile" ]; then
    local pid
    pid=$(cat "$pidfile")
    if kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

wait_for_port() {
  local port=$1 max=${2:-30}
  for i in $(seq 1 "$max"); do
    if curl -s "http://localhost:$port/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# --- Start ---
do_start() {
  echo "🏰 Starting The Fellowship..."

  # 1. Docker / PostgreSQL
  echo "  → PostgreSQL..."
  bash scripts/ensure-postgres.sh "$ENV_FILE" 2>&1 | tail -1

  # 2. Migrations
  echo "  → Migrations..."
  (cd server && go run ./cmd/migrate up 2>&1 | tail -1)

  # 3. Backend
  if is_running backend; then
    echo "  → Backend already running (pid $(cat "$PID_DIR/backend.pid"))"
  else
    echo "  → Backend (port $PORT)..."
    (cd server && go run ./cmd/server) > "$LOG_DIR/backend.log" 2>&1 &
    echo $! > "$PID_DIR/backend.pid"
    if wait_for_port "$PORT" 15; then
      echo "    ✓ Backend ready"
    else
      echo "    ✗ Backend failed to start — check $LOG_DIR/backend.log"
      return 1
    fi
  fi

  # 4. Frontend
  if is_running frontend; then
    echo "  → Frontend already running (pid $(cat "$PID_DIR/frontend.pid"))"
  else
    echo "  → Frontend (port $FRONTEND_PORT)..."
    pnpm dev:web > "$LOG_DIR/frontend.log" 2>&1 &
    echo $! > "$PID_DIR/frontend.pid"
    sleep 5
    echo "    ✓ Frontend started"
  fi

  # 5. Daemon
  echo "  → Daemon..."
  (cd server && go run ./cmd/multica daemon start) 2>&1 | tail -1
  echo "    ✓ Daemon started"

  echo ""
  echo "✓ The Fellowship is operational."
  echo "  Dashboard: http://localhost:$FRONTEND_PORT"
  echo "  Backend:   http://localhost:$PORT"
  echo "  Logs:      $LOG_DIR/"
}

# --- Stop ---
do_stop() {
  echo "🛑 Stopping The Fellowship..."

  # Stop daemon
  (cd "$REPO_ROOT/server" && go run ./cmd/multica daemon stop 2>/dev/null) || true

  # Stop frontend
  if [ -f "$PID_DIR/frontend.pid" ]; then
    local pid
    pid=$(cat "$PID_DIR/frontend.pid")
    kill "$pid" 2>/dev/null || true
    # Kill child processes (turbo spawns subprocesses)
    pkill -P "$pid" 2>/dev/null || true
    rm -f "$PID_DIR/frontend.pid"
    echo "  ✓ Frontend stopped"
  fi

  # Stop backend
  if [ -f "$PID_DIR/backend.pid" ]; then
    local pid
    pid=$(cat "$PID_DIR/backend.pid")
    kill "$pid" 2>/dev/null || true
    rm -f "$PID_DIR/backend.pid"
    echo "  ✓ Backend stopped"
  fi

  # Also kill by port as fallback
  lsof -ti:"$PORT" | xargs kill -9 2>/dev/null || true
  lsof -ti:"$FRONTEND_PORT" | xargs kill -9 2>/dev/null || true

  echo "✓ All services stopped. PostgreSQL still running (shared)."
}

# --- Status ---
do_status() {
  echo "🏰 The Fellowship — Service Status"
  echo ""

  # PostgreSQL
  if docker ps --filter name=postgres -q 2>/dev/null | grep -q .; then
    echo "  ✅ PostgreSQL     (Docker)"
  else
    echo "  ❌ PostgreSQL     (not running)"
  fi

  # Backend
  if curl -s "http://localhost:$PORT/health" >/dev/null 2>&1; then
    echo "  ✅ Backend        (port $PORT)"
  else
    echo "  ❌ Backend        (not running)"
  fi

  # Frontend
  if curl -s -o /dev/null -w "" "http://localhost:$FRONTEND_PORT" 2>/dev/null; then
    echo "  ✅ Frontend       (port $FRONTEND_PORT)"
  else
    echo "  ❌ Frontend       (not running)"
  fi

  # Daemon
  if [ -f ~/.multica/daemon.pid ] && kill -0 "$(cat ~/.multica/daemon.pid)" 2>/dev/null; then
    echo "  ✅ Daemon         (pid $(cat ~/.multica/daemon.pid))"
  else
    echo "  ❌ Daemon         (not running)"
  fi

  echo ""
  echo "  Dashboard: http://localhost:$FRONTEND_PORT"
}

# --- Main ---
case "${1:-}" in
  start)   do_start ;;
  stop)    do_stop ;;
  restart) do_stop; sleep 2; do_start ;;
  status)  do_status ;;
  *)
    echo "Usage: $0 {start|stop|restart|status}"
    exit 1
    ;;
esac
