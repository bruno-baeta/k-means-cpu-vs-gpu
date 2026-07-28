import numpy as np


def relocate_empty_clusters(points: np.ndarray, centroids: np.ndarray, assignments: np.ndarray, k: int) -> bool:
    counts = np.bincount(assignments, minlength=k)
    empty = np.where(counts == 0)[0]
    if empty.size == 0:
        return False

    dist_sq = np.sum((points - centroids[assignments]) ** 2, axis=1)
    for c in empty:
        farthest = np.argmax(dist_sq)
        centroids[c] = points[farthest]
        dist_sq[farthest] = -1
    return True
