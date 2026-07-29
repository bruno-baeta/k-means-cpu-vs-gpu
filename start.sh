#!/usr/bin/env bash
# Inicia o K-Means CUDA Visualizer como aplicativo desktop (pywebview).
#
# Não existe um servidor web separado: desktop_main.py sobe, no mesmo processo,
# um servidor HTTP local (porta 8734) só para servir os arquivos estáticos de
# frontend/dist, e expõe toda a lógica de K-Means (CPU/GPU) direto para a janela
# via js_api (ver backend/app/desktop_api.py). Este script garante que as
# dependências (venv, extensão CUDA, build do frontend) existem antes de abrir a janela.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
VENV_PY="$BACKEND_DIR/.venv/bin/python3"

if [[ ! -x "$VENV_PY" ]]; then
  echo "Erro: virtualenv do backend não encontrado em backend/.venv" >&2
  echo "Crie com:" >&2
  echo "  cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi

if ! compgen -G "$BACKEND_DIR/cuda_ext/kmeans_cuda*.so" > /dev/null; then
  echo "== extensão CUDA não encontrada, tentando compilar (cuda_ext/build.sh) =="
  if ! (cd "$BACKEND_DIR/cuda_ext" && ./build.sh); then
    echo "Aviso: build da extensão CUDA falhou. O app vai abrir só com a coluna CPU." >&2
  fi
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "== instalando dependências do frontend (npm install) =="
  (cd "$FRONTEND_DIR" && npm install)
fi

needs_build=0
if [[ ! -f "$FRONTEND_DIR/dist/index.html" ]]; then
  needs_build=1
elif find "$FRONTEND_DIR/src" "$FRONTEND_DIR/index.html" -newer "$FRONTEND_DIR/dist/index.html" -print -quit | grep -q .; then
  needs_build=1
fi

if [[ "$needs_build" == "1" ]]; then
  echo "== compilando frontend (npm run build) =="
  (cd "$FRONTEND_DIR" && npm run build)
else
  echo "== frontend/dist já está atualizado, pulando build =="
fi

echo "== iniciando app desktop =="
exec "$VENV_PY" "$BACKEND_DIR/desktop_main.py"
