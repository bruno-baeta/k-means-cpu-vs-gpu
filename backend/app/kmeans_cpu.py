import math
import os
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np

from .data_gen import init_centroids
from .empty_clusters import relocate_empty_clusters


class CPUKMeansEngine:
    def __init__(
        self, points: np.ndarray, k: int, seed: int, num_threads: int | None = None, dramatic_init: bool = False
    ):
        if points.ndim != 2 or points.shape[1] != 2:
            raise ValueError("points must be an (N, 2) array")
        if k < 1 or k > points.shape[0]:
            raise ValueError("k must be between 1 and N")

        self.points = np.ascontiguousarray(points, dtype=np.float32)
        self.k = k
        self.n = points.shape[0]
        self.num_threads = num_threads or os.cpu_count() or 1
        self._pool = ThreadPoolExecutor(max_workers=self.num_threads)

        self.centroids = init_centroids(self.points, k, seed, dramatic=dramatic_init)
        self.assignments = np.full(self.n, -1, dtype=np.int32)
        self.iteration = 0
        self.converged = False
        self.total_time_ms = 0.0

    def _chunk_bounds(self):
        chunk_size = math.ceil(self.n / self.num_threads)
        return [
            (i, min(i + chunk_size, self.n))
            for i in range(0, self.n, chunk_size)
        ]

    def _assign_chunk(self, bounds):
        start, end = bounds
        chunk = self.points[start:end]
        diffs = chunk[:, None, :] - self.centroids[None, :, :]
        dist_sq = np.einsum("nkd,nkd->nk", diffs, diffs)
        return np.argmin(dist_sq, axis=1).astype(np.int32)

    def step(self) -> dict:
        t0 = time.perf_counter()

        bounds = self._chunk_bounds()
        results = list(self._pool.map(self._assign_chunk, bounds))
        new_assignments = np.concatenate(results)

        t1 = time.perf_counter()

        new_centroids = self.centroids.copy()
        for c in range(self.k):
            mask = new_assignments == c
            if np.any(mask):
                new_centroids[c] = self.points[mask].mean(axis=0)

        relocated = relocate_empty_clusters(self.points, new_centroids, new_assignments, self.k)

        t2 = time.perf_counter()

        self.converged = self.iteration > 0 and not relocated and np.array_equal(new_assignments, self.assignments)
        self.assignments = new_assignments
        self.centroids = new_centroids
        self.iteration += 1

        assign_ms = (t1 - t0) * 1000
        update_ms = (t2 - t1) * 1000
        iter_ms = (t2 - t0) * 1000
        self.total_time_ms += iter_ms

        return {
            "iteration": self.iteration,
            "threads_used": len(bounds),
            "assign_ms": assign_ms,
            "update_ms": update_ms,
            "iter_ms": iter_ms,
            "total_ms": self.total_time_ms,
            "converged": bool(self.converged),
            "centroids": self.centroids,
            "assignments": self.assignments,
        }

    def close(self):
        self._pool.shutdown(wait=False)
