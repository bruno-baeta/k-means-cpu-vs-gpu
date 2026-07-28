import threading

import numpy as np

from .data_gen import generate_blob_points
from .gpu_engine import GPU_EXTENSION_AVAILABLE, GPUKMeansEngine, gpu_device_info
from .kmeans_cpu import CPUKMeansEngine
from .protocol import encode_frame_update, encode_points_init
from .source_view import get_cpu_source, get_gpu_source
from .system_stats import CPUStatsCollector, GPUStatsCollector

MAX_ITERATIONS = 300
MAX_POINTS = 2_000_000
MAX_K = 64
MAX_DELAY_MS = 3000


class ConfigError(ValueError):
    pass


class EngineRuntime:
    def __init__(self):
        self.lock = threading.Lock()
        self.iteration = 0
        self.converged = False
        self.centroids: np.ndarray | None = None
        self.assignments: np.ndarray | None = None
        self.stats: dict | None = None

    def update(self, iteration, converged, centroids, assignments, stats=None):
        with self.lock:
            self.iteration = iteration
            self.converged = converged
            self.centroids = centroids
            self.assignments = assignments
            if stats is not None:
                self.stats = stats

    def snapshot(self):
        with self.lock:
            return self.iteration, self.converged, self.centroids, self.assignments, self.stats


class KMeansRuntime:
    def __init__(self):
        self.points: np.ndarray | None = None
        self.cpu_engine: CPUKMeansEngine | None = None
        self.gpu_engine: GPUKMeansEngine | None = None
        self.cpu_rt = EngineRuntime()
        self.gpu_rt = EngineRuntime()
        self.cpu_stats = CPUStatsCollector()
        self.gpu_stats = GPUStatsCollector()

        self.delay_ms = 1000
        self.step_mode = False
        self._gen = 0
        self._threads: list[threading.Thread] = []
        self._running = threading.Event()
        self._paused = threading.Event()
        self._paused.set()
        self._step_requested = threading.Event()
        self._wake = threading.Event()
        self._done_count = 0
        self._done_lock = threading.Lock()
        self.benchmark_result: dict | None = None
        self._last_cfg: dict | None = None
        self._config_lock = threading.Lock()

    def ready(self):
        return {
            "gpu_available": GPU_EXTENSION_AVAILABLE,
            "gpu_info": gpu_device_info(),
        }

    def get_source(self, engine_name: str):
        return get_cpu_source() if engine_name == "cpu" else get_gpu_source()

    def configure(self, cfg: dict):
        n = int(cfg.get("num_points", 2000))
        k = int(cfg.get("k", 3))
        seed = int(cfg.get("seed", 0))
        delay_ms = int(cfg.get("delay_ms", 1000))
        step_mode = bool(cfg.get("step_mode", False))
        block_size = int(cfg.get("block_size", 256))

        if not (2 <= n <= MAX_POINTS):
            raise ConfigError(f"num_points must be between 2 and {MAX_POINTS}")
        if not (1 <= k <= min(MAX_K, n)):
            raise ConfigError(f"k must be between 1 and {min(MAX_K, n)}")
        if not (0 <= delay_ms <= MAX_DELAY_MS):
            raise ConfigError(f"delay_ms must be between 0 and {MAX_DELAY_MS}")

        self._stop()

        with self._config_lock:
            self.delay_ms = delay_ms
            self.step_mode = step_mode
            self._last_cfg = dict(cfg)
            self.benchmark_result = None

            self.points = generate_blob_points(n, k, seed)
            dramatic_init = delay_ms > 0

            if self.cpu_engine is not None:
                self.cpu_engine.close()
            self.cpu_engine = CPUKMeansEngine(self.points, k, seed, dramatic_init=dramatic_init)
            self.cpu_rt = EngineRuntime()

            if self.gpu_engine is not None:
                self.gpu_engine.close()
            self.gpu_engine = None
            gpu_error = None
            if GPU_EXTENSION_AVAILABLE:
                try:
                    self.gpu_engine = GPUKMeansEngine(self.points, k, seed, block_size, dramatic_init=dramatic_init)
                except Exception as exc:
                    gpu_error = str(exc)
            self.gpu_rt = EngineRuntime()

        return {
            "num_points": n,
            "k": k,
            "seed": seed,
            "delay_ms": delay_ms,
            "step_mode": step_mode,
            "gpu_available": self.gpu_engine is not None,
            "gpu_error": gpu_error,
            "max_iterations": MAX_ITERATIONS,
        }

    def get_points_bytes(self):
        with self._config_lock:
            if self.points is None:
                return None
            return encode_points_init(self.points)

    def start(self):
        if self.points is None:
            raise ConfigError("call configure before start")
        if self._running.is_set():
            return
        self._running.set()
        self._paused.set()
        self._wake.clear()
        self._gen += 1
        gen = self._gen
        self._done_count = 0

        engines = [("cpu", self.cpu_engine, self.cpu_rt)]
        if self.gpu_engine is not None:
            engines.append(("gpu", self.gpu_engine, self.gpu_rt))

        self._threads = []
        for name, engine, rt in engines:
            t = threading.Thread(target=self._run_loop, args=(name, engine, rt, gen, len(engines)), daemon=True)
            t.start()
            self._threads.append(t)

    def pause(self):
        self._paused.clear()

    def resume(self):
        self._paused.set()

    def step(self):
        self._step_requested.set()

    def reset(self):
        if self._last_cfg is not None:
            return self.configure(self._last_cfg)

    def _stop(self):
        self._running.clear()
        self._paused.set()
        self._step_requested.set()
        self._wake.set()
        for t in self._threads:
            t.join(timeout=5)
        self._threads = []

    def _run_loop(self, name, engine, rt, gen, total_engines):
        last_result = None
        while self._running.is_set() and gen == self._gen:
            if self.step_mode:
                self._step_requested.wait()
                self._step_requested.clear()
            else:
                self._paused.wait()

            if engine.converged or engine.iteration >= MAX_ITERATIONS:
                break

            result = engine.step()
            last_result = result
            stats = self._build_stats(name, result) if result["converged"] else None
            rt.update(result["iteration"], result["converged"], result["centroids"], result["assignments"], stats)

            if self.delay_ms > 0 and not self.step_mode:
                self._wake.wait(self.delay_ms / 1000)

        stopped_at_max_iterations = self._running.is_set() and gen == self._gen and not engine.converged
        if stopped_at_max_iterations and last_result is not None:
            stats = self._build_stats(name, last_result)
            rt.update(last_result["iteration"], True, last_result["centroids"], last_result["assignments"], stats)

        with self._done_lock:
            self._done_count += 1
            if self._done_count == total_engines and gen == self._gen:
                self._compute_benchmark_result()

    def _build_stats(self, name, result):
        if name == "cpu":
            extra = self.cpu_stats.sample(result["threads_used"])
            return {
                "engine": "cpu",
                "iteration": result["iteration"],
                "assign_ms": result["assign_ms"],
                "update_ms": result["update_ms"],
                "iter_ms": result["iter_ms"],
                "total_ms": result["total_ms"],
                "converged": result["converged"],
                **extra,
            }
        extra = self.gpu_stats.sample()
        return {
            "engine": "gpu",
            "iteration": result["iteration"],
            "assign_ms": result["assign_ms"],
            "update_ms": result["update_ms"],
            "iter_ms": result["iter_ms"],
            "total_ms": result["total_ms"],
            "converged": result["converged"],
            "grid_size": result["grid_size"],
            "block_size": result["block_size"],
            "threads_launched": result["threads_launched"],
            **extra,
        }

    def _compute_benchmark_result(self):
        n = self.points.shape[0]
        cpu_time_ms = self.cpu_engine.total_time_ms
        cpu_iterations = self.cpu_engine.iteration
        cpu_throughput = (n * cpu_iterations) / (cpu_time_ms / 1000) if cpu_time_ms > 0 else 0.0

        gpu_time_ms = None
        gpu_iterations = None
        gpu_throughput = None
        speedup = None
        if self.gpu_engine is not None:
            gpu_time_ms = self.gpu_engine.total_time_ms
            gpu_iterations = self.gpu_engine.iteration
            gpu_throughput = (n * gpu_iterations) / (gpu_time_ms / 1000) if gpu_time_ms > 0 else 0.0
            if gpu_time_ms > 0:
                speedup = cpu_time_ms / gpu_time_ms

        self.benchmark_result = {
            "num_points": n,
            "cpu_time_ms": cpu_time_ms,
            "cpu_iterations": cpu_iterations,
            "cpu_throughput_points_per_s": cpu_throughput,
            "gpu_time_ms": gpu_time_ms,
            "gpu_iterations": gpu_iterations,
            "gpu_throughput_points_per_s": gpu_throughput,
            "speedup": speedup,
        }

    def get_frame_bytes(self, engine_name: str):
        with self._config_lock:
            rt = self.cpu_rt if engine_name == "cpu" else self.gpu_rt
        iteration, converged, centroids, assignments, _ = rt.snapshot()
        if centroids is None:
            return None
        return encode_frame_update(engine_name, iteration, converged, centroids, assignments)

    def get_stats(self, engine_name: str):
        with self._config_lock:
            rt = self.cpu_rt if engine_name == "cpu" else self.gpu_rt
        return rt.snapshot()[4]

    def get_benchmark_result(self):
        return self.benchmark_result

    def shutdown(self):
        self._stop()
        if self.cpu_engine:
            self.cpu_engine.close()
        if self.gpu_engine:
            self.gpu_engine.close()
