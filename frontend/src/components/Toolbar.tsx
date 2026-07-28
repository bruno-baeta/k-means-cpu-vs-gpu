import { Pause, Play, RotateCcw, Settings } from "lucide-react";
import type { RunState } from "../lib/types";

interface Props {
  runState: RunState;
  connected: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onOpenConfig: () => void;
}

export function Toolbar({ runState, connected, onStart, onPause, onResume, onReset, onOpenConfig }: Props) {
  const isRunning = runState === "running";
  const isPaused = runState === "paused";

  return (
    <div className="header-toolbar">
      <div className="toolbar-actions">
        {!isRunning && !isPaused && (
          <button className="primary" onClick={onStart} disabled={!connected}>
            <Play size={16} />
            Iniciar
          </button>
        )}
        {isRunning && (
          <button onClick={onPause} disabled={!connected}>
            <Pause size={16} />
            Pausar
          </button>
        )}
        {isPaused && (
          <button onClick={onResume} disabled={!connected}>
            <Play size={16} />
            Retomar
          </button>
        )}
        <button onClick={onReset} disabled={!connected}>
          <RotateCcw size={16} />
          Reiniciar
        </button>
      </div>

      <button className="icon-btn" onClick={onOpenConfig} aria-label="Configurações">
        <Settings size={18} />
      </button>
    </div>
  );
}
