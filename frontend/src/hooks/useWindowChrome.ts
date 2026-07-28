import { useRef } from "react";

const DOUBLE_CLICK_MS = 400;

export function useWindowChrome() {
  const lastMouseDownAt = useRef(0);

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, input, a")) return;
    const now = Date.now();
    if (now - lastMouseDownAt.current < DOUBLE_CLICK_MS) {
      lastMouseDownAt.current = 0;
      window.pywebview?.api.window_toggle_maximize();
      return;
    }
    lastMouseDownAt.current = now;
    window.pywebview?.api.window_begin_drag();
  };

  return { onHeaderMouseDown };
}
