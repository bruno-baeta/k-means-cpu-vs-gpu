import os
import sys

import numpy as np

from .data_gen import init_centroids
from .empty_clusters import relocate_empty_clusters

_CUDA_EXT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cuda_ext")
if _CUDA_EXT_DIR not in sys.path:
    sys.path.insert(0, _CUDA_EXT_DIR)

try:
    import kmeans_cuda as _kc

    GPU_EXTENSION_AVAILABLE = True
except ImportError:
    _kc = None
    GPU_EXTENSION_AVAILABLE = False


def gpu_device_info():
    if not GPU_EXTENSION_AVAILABLE:
        return None
    try:
        return _kc.device_info()
    except Exception:
        return None


def gpu_vram_info():
    if not GPU_EXTENSION_AVAILABLE:
        return None
    try:
        return _kc.vram_info()
    except Exception:
        return None


class GPUKMeansEngine:
    def __init__(self, points: np.ndarray, k: int, seed: int, block_size: int = 256, dramatic_init: bool = False):
        if not GPU_EXTENSION_AVAILABLE:
            raise RuntimeError("kmeans_cuda extension is not available")

        self.k = k
        self.n = points.shape[0]
        centroids0 = init_centroids(points, k, seed, dramatic=dramatic_init)

        self.points = np.ascontiguousarray(points, dtype=np.float32)
        self.x = np.ascontiguousarray(points[:, 0], dtype=np.float32)
        self.y = np.ascontiguousarray(points[:, 1], dtype=np.float32)
        self._gpu = _kc.GPUKMeans(self.x, self.y, centroids0, block_size)

        self.iteration = 0
        self.converged = False
        self.total_time_ms = 0.0
        self.assignments = np.full(self.n, -1, dtype=np.int32)
        self.centroids = centroids0

    def step(self) -> dict:
        r = self._gpu.step()
        new_assignments = r["assignments"]
        new_centroids = r["centroids"]

        relocated = relocate_empty_clusters(self.points, new_centroids, new_assignments, self.k)
        if relocated:
            self._gpu.set_centroids(new_centroids)

        self.converged = self.iteration > 0 and not relocated and np.array_equal(new_assignments, self.assignments)
        self.assignments = new_assignments
        self.centroids = new_centroids
        self.iteration += 1
        iter_ms = r["assign_ms"] + r["update_ms"]
        self.total_time_ms += iter_ms
        return {
            "iteration": self.iteration,
            "assign_ms": r["assign_ms"],
            "update_ms": r["update_ms"],
            "iter_ms": iter_ms,
            "total_ms": self.total_time_ms,
            "converged": bool(self.converged),
            "centroids": self.centroids,
            "assignments": self.assignments,
            "grid_size": r["grid_size"],
            "block_size": r["block_size"],
            "threads_launched": r["threads_launched"],
        }

    def close(self):
        self._gpu = None
