import struct

import numpy as np

MSG_POINTS_INIT = 1
MSG_FRAME_UPDATE = 2

ENGINE_IDS = {"cpu": 0, "gpu": 1}


def encode_points_init(points: np.ndarray) -> bytes:
    n = points.shape[0]
    header = struct.pack("<BI", MSG_POINTS_INIT, n)
    body = np.ascontiguousarray(points, dtype=np.float32).tobytes()
    return header + body


def encode_frame_update(
    engine: str, iteration: int, converged: bool, centroids: np.ndarray, assignments: np.ndarray
) -> bytes:
    k = centroids.shape[0]
    header = struct.pack("<BBBII", MSG_FRAME_UPDATE, ENGINE_IDS[engine], int(converged), iteration, k)
    centroids_bytes = np.ascontiguousarray(centroids, dtype=np.float32).tobytes()
    assign_bytes = np.ascontiguousarray(assignments, dtype=np.uint8).tobytes()
    return header + centroids_bytes + assign_bytes
