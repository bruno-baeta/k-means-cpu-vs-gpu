import { Minus, Square, X } from "lucide-react";

export function WindowControls() {
  const api = window.pywebview?.api;

  return (
    <div className="window-controls">
      <button className="window-btn" onClick={() => api?.window_minimize()} aria-label="Minimizar">
        <Minus size={14} />
      </button>
      <button className="window-btn" onClick={() => api?.window_toggle_maximize()} aria-label="Maximizar">
        <Square size={12} />
      </button>
      <button className="window-btn window-btn-close" onClick={() => api?.window_close()} aria-label="Fechar">
        <X size={14} />
      </button>
    </div>
  );
}
