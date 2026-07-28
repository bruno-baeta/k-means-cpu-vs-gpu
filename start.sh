#!/usr/bin/env bash
# Sobe o backend (FastAPI + WebSocket na porta 8000) e o frontend (Vite na porta 5173).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  echo "Encerrando..."
  kill "${BACKEND_PID:-}" "${FRONTEND_PID:-}" 2>/dev/null || true
}
trap cleanup EXIT

echo "== iniciando backend (http://localhost:8000) =="
(cd "$SCRIPT_DIR/backend" && .venv/bin/python3 -m uvicorn app.server:app --host 0.0.0.0 --port 8000) &
BACKEND_PID=$!

echo "== iniciando frontend (http://localhost:5173) =="
(cd "$SCRIPT_DIR/frontend" && npm run dev -- --host 0.0.0.0 --port 5173) &
FRONTEND_PID=$!

echo ""
echo "Pronto. Acesse: http://localhost:5173"
echo "Ctrl+C para encerrar os dois processos."

wait
