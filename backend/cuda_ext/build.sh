#!/usr/bin/env bash
set -euo pipefail

CUDA_HOME="${CUDA_HOME:-/usr/local/cuda-13.3}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PYTHON="$BACKEND_DIR/.venv/bin/python3"

cd "$SCRIPT_DIR"

echo "== compiling CUDA kernels with nvcc =="
"$CUDA_HOME/bin/nvcc" -c kmeans_kernel.cu -o kmeans_kernel.o -Xcompiler -fPIC -O3 -std=c++17

PYBIND_INCLUDE_DIR=$("$PYTHON" -c "import pybind11; print(pybind11.get_include())")
PY_INCLUDE_DIR=$("$PYTHON" -c "import sysconfig; print(sysconfig.get_path('include'))")
EXT_SUFFIX=$("$PYTHON" -c "import sysconfig; print(sysconfig.get_config_var('EXT_SUFFIX'))")

echo "== compiling + linking pybind11 module with g++ =="
g++ -O3 -shared -std=c++17 -fPIC \
    -I"$PYBIND_INCLUDE_DIR" -I"$PY_INCLUDE_DIR" \
    bindings.cpp kmeans_kernel.o \
    -o "kmeans_cuda${EXT_SUFFIX}" \
    -L"$CUDA_HOME/lib64" -lcudart -Wl,-rpath,"$CUDA_HOME/lib64"

echo "== build ok: $SCRIPT_DIR/kmeans_cuda${EXT_SUFFIX} =="
