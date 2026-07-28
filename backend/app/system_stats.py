import os

import psutil

try:
    import pynvml

    _NVML_AVAILABLE = True
except ImportError:
    _NVML_AVAILABLE = False


class CPUStatsCollector:
    def __init__(self):
        self._process = psutil.Process(os.getpid())
        psutil.cpu_percent(interval=None)
        self._process.cpu_percent(interval=None)

    def sample(self, threads_used: int) -> dict:
        mem = psutil.virtual_memory()
        return {
            "threads_used": threads_used,
            "logical_cores": os.cpu_count() or 1,
            "system_cpu_percent": psutil.cpu_percent(interval=None),
            "process_cpu_percent": self._process.cpu_percent(interval=None),
            "process_ram_mb": self._process.memory_info().rss / (1024 * 1024),
            "system_ram_used_mb": mem.used / (1024 * 1024),
            "system_ram_total_mb": mem.total / (1024 * 1024),
        }


class GPUStatsCollector:
    def __init__(self, index: int = 0):
        self.available = _NVML_AVAILABLE
        self._handle = None
        if self.available:
            try:
                pynvml.nvmlInit()
                self._handle = pynvml.nvmlDeviceGetHandleByIndex(index)
            except Exception:
                self.available = False

    def static_info(self) -> dict:
        if not self.available:
            return {"name": "unavailable"}
        name = pynvml.nvmlDeviceGetName(self._handle)
        if isinstance(name, bytes):
            name = name.decode()
        return {"name": name}

    def sample(self) -> dict:
        if not self.available:
            return {
                "gpu_util_percent": 0,
                "mem_util_percent": 0,
                "vram_used_mb": 0,
                "vram_total_mb": 0,
            }
        util = pynvml.nvmlDeviceGetUtilizationRates(self._handle)
        mem = pynvml.nvmlDeviceGetMemoryInfo(self._handle)
        return {
            "gpu_util_percent": util.gpu,
            "mem_util_percent": util.memory,
            "vram_used_mb": mem.used / (1024 * 1024),
            "vram_total_mb": mem.total / (1024 * 1024),
        }
