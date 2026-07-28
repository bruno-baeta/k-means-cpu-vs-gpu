import http.server
import os
import threading

import webview

from app.desktop_api import DesktopApi

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIST = os.path.abspath(os.path.join(BACKEND_DIR, "..", "frontend", "dist"))
STATIC_PORT = 8734


class ApiRequestHandler(http.server.SimpleHTTPRequestHandler):
    api: DesktopApi = None  # type: ignore[assignment]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIST, **kwargs)

    def _send_binary(self, payload: bytes | None):
        if payload is None:
            self.send_response(204)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path == "/api/points":
            self._send_binary(self.api.get_points_bytes())
            return
        if self.path in ("/api/frame/cpu", "/api/frame/gpu"):
            engine = self.path.rsplit("/", 1)[-1]
            self._send_binary(self.api.get_frame_bytes(engine))
            return
        super().do_GET()

    def log_message(self, format, *args):
        pass


def serve_http(api: DesktopApi):
    handler_cls = type("BoundApiRequestHandler", (ApiRequestHandler,), {"api": api})
    server = http.server.ThreadingHTTPServer(("127.0.0.1", STATIC_PORT), handler_cls)
    server.serve_forever()


def main():
    try:
        import gi

        gi.require_version("Gtk", "3.0")
        from gi.repository import GLib

        GLib.set_prgname("kmeans-cuda-visualizer")
        GLib.set_application_name("K-Means CPU x GPU (CUDA)")
    except Exception:
        pass

    api = DesktopApi()
    threading.Thread(target=serve_http, args=(api,), daemon=True).start()

    window = webview.create_window(
        "K-Means CPU x GPU (CUDA)",
        url=f"http://127.0.0.1:{STATIC_PORT}/index.html",
        js_api=api,
        width=1440,
        height=920,
        frameless=True,
        easy_drag=False,
        background_color="#0a0b0f",
    )
    api.bind_window(window)

    def on_closed():
        api.shutdown()
        os._exit(0)

    window.events.closed += on_closed
    webview.start()


if __name__ == "__main__":
    main()
