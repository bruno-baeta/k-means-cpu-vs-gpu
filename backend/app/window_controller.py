class WindowController:
    def __init__(self):
        self.window = None
        self._maximized = False

    def bind(self, window):
        self.window = window

    def _gtk_window(self):
        if self.window is None:
            return None
        from webview.platforms.gtk import BrowserView

        instance = BrowserView.instances.get(self.window.uid)
        return instance.window if instance else None

    def begin_drag(self):
        gtk_window = self._gtk_window()
        if gtk_window is None:
            return
        try:
            import gi

            gi.require_version("Gdk", "3.0")
            gi.require_version("Gtk", "3.0")
            from gi.repository import Gdk, Gtk

            seat = Gdk.Display.get_default().get_default_seat()
            _, x_root, y_root = seat.get_pointer().get_position()
            gtk_window.begin_move_drag(1, x_root, y_root, Gtk.get_current_event_time())
        except Exception:
            pass

    def minimize(self):
        if self.window is not None:
            self.window.minimize()

    def toggle_maximize(self):
        gtk_window = self._gtk_window()
        if gtk_window is None:
            return
        self._maximized = not self._maximized
        if self._maximized:
            gtk_window.maximize()
        else:
            gtk_window.unmaximize()

    def close(self):
        if self.window is not None:
            self.window.destroy()
