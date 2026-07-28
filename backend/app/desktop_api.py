from .kmeans_runtime import ConfigError, KMeansRuntime
from .window_controller import WindowController

__all__ = ["ConfigError", "DesktopApi"]


class DesktopApi:
    """pywebview js_api surface: a thin facade over KMeansRuntime + WindowController."""

    def __init__(self):
        self.runtime = KMeansRuntime()
        self.window_controller = WindowController()

    def bind_window(self, window):
        self.window_controller.bind(window)

    def window_begin_drag(self):
        self.window_controller.begin_drag()

    def window_minimize(self):
        self.window_controller.minimize()

    def window_toggle_maximize(self):
        self.window_controller.toggle_maximize()

    def window_close(self):
        self.window_controller.close()

    def ready(self):
        return self.runtime.ready()

    def get_source(self, engine_name: str):
        return self.runtime.get_source(engine_name)

    def configure(self, cfg: dict):
        return self.runtime.configure(cfg)

    def get_points_bytes(self):
        return self.runtime.get_points_bytes()

    def start(self):
        return self.runtime.start()

    def pause(self):
        return self.runtime.pause()

    def resume(self):
        return self.runtime.resume()

    def step(self):
        return self.runtime.step()

    def reset(self):
        return self.runtime.reset()

    def get_frame_bytes(self, engine_name: str):
        return self.runtime.get_frame_bytes(engine_name)

    def get_stats(self, engine_name: str):
        return self.runtime.get_stats(engine_name)

    def get_benchmark_result(self):
        return self.runtime.get_benchmark_result()

    def shutdown(self):
        self.runtime.shutdown()
