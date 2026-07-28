import inspect
import os

from .kmeans_cpu import CPUKMeansEngine

_CUDA_KERNEL_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cuda_ext", "kmeans_kernel.cu"
)


def _find(lines, needle, start=0):
    for i in range(start, len(lines)):
        if needle in lines[i]:
            return i
    raise ValueError(f"anchor not found: {needle!r}")


def get_cpu_source() -> dict:
    source = inspect.getsource(CPUKMeansEngine.step).rstrip("\n")
    lines = source.split("\n")

    assign_start = _find(lines, "_chunk_bounds")
    assign_end = _find(lines, "np.concatenate")
    update_start = _find(lines, "new_centroids = self.centroids.copy()")
    update_end = _find(lines, "relocate_empty_clusters")

    return {
        "code": source,
        "assign_range": [assign_start + 1, assign_end + 1],
        "update_range": [update_start + 1, update_end + 1],
    }


def get_gpu_source() -> dict:
    with open(_CUDA_KERNEL_PATH) as f:
        lines = f.read().split("\n")

    assign_start = _find(lines, "__global__ void assign_kernel")
    accumulate_start = _find(lines, "__global__ void accumulate_kernel", assign_start)
    finalize_start = _find(lines, "__global__ void finalize_kernel", accumulate_start)

    depth = 0
    started = False
    finalize_end = finalize_start
    for i in range(finalize_start, len(lines)):
        depth += lines[i].count("{") - lines[i].count("}")
        started = started or "{" in lines[i]
        if started and depth == 0:
            finalize_end = i
            break

    kernel_lines = lines[assign_start : finalize_end + 1]

    def rel(idx: int) -> int:
        return idx - assign_start

    return {
        "code": "\n".join(kernel_lines),
        "assign_range": [1, rel(accumulate_start) - 1],
        "update_range": [rel(accumulate_start) + 1, rel(finalize_end) + 1],
    }
