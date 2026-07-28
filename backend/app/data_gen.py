import numpy as np

DOMAIN = 100.0


def generate_blob_points(n: int, k: int, seed: int, spread_ratio: float = 0.06) -> np.ndarray:
    rng = np.random.default_rng(seed)
    margin = DOMAIN * 0.15
    centers = rng.uniform(margin, DOMAIN - margin, size=(k, 2))

    counts = np.full(k, n // k, dtype=int)
    counts[: n % k] += 1

    spread = DOMAIN * spread_ratio
    parts = [rng.normal(loc=centers[c], scale=spread, size=(counts[c], 2)) for c in range(k)]
    points = np.vstack(parts)
    points = points[rng.permutation(points.shape[0])]

    return np.clip(points, 0, DOMAIN).astype(np.float32)


def init_centroids(points: np.ndarray, k: int, seed: int, dramatic: bool = False) -> np.ndarray:
    rng = np.random.default_rng(seed + 1)
    if dramatic:
        return rng.uniform(0, DOMAIN, size=(k, 2)).astype(np.float32)
    idx = rng.choice(points.shape[0], size=k, replace=False)
    return np.ascontiguousarray(points[idx], dtype=np.float32)
