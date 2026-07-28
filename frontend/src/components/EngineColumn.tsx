import { Activity, Code2, Grid3x3, X, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { engineStatusInfo } from "../lib/status";
import type { GpuStats, RunState } from "../lib/types";
import type { EngineState } from "../store/useKMeansStore";
import { CodePanel } from "./CodeViewer";
import { CudaArchViz } from "./CudaArchViz";
import { ScatterCanvas } from "./ScatterCanvas";
import { CpuStatsPanel, GpuStatsPanel } from "./StatsPanel";

type View = "sim" | "code" | "arch";

interface Props {
  engineName: "cpu" | "gpu";
  label: string;
  icon: LucideIcon;
  accent: string;
  points: Float32Array | null;
  engine: EngineState;
  runState: RunState;
  numPoints?: number;
}

export function EngineColumn({ engineName, label, icon: Icon, accent, points, engine, runState, numPoints }: Props) {
  const status = engineStatusInfo(runState, engine.converged);
  const [view, setView] = useState<View>("sim");
  const [dismissedAtIteration, setDismissedAtIteration] = useState<number | null>(null);
  const showResult = engine.converged && engine.stats && dismissedAtIteration !== engine.iteration;

  useEffect(() => {
    if (!engine.converged) setDismissedAtIteration(null);
  }, [engine.converged]);

  return (
    <div className="engine-column">
      <div className="engine-column-header" style={{ borderColor: accent }}>
        <div className="engine-column-title" style={{ color: accent }}>
          <Icon size={16} />
          <span>{label}</span>
        </div>
        <div className="engine-column-header-actions">
          <div className="view-switch">
            <button
              className={view === "sim" ? "active" : ""}
              onClick={() => setView("sim")}
              aria-label="Simulação"
              title="Simulação"
            >
              <Activity size={15} />
            </button>
            <button
              className={view === "code" ? "active" : ""}
              onClick={() => setView("code")}
              aria-label="Código"
              title="Código"
            >
              <Code2 size={15} />
            </button>
            {engineName === "gpu" && (
              <button
                className={view === "arch" ? "active" : ""}
                onClick={() => setView("arch")}
                aria-label="Arquitetura CUDA"
                title="Arquitetura CUDA"
              >
                <Grid3x3 size={15} />
              </button>
            )}
          </div>
          <span className={`status-chip status-${status.tone}`}>
            <span aria-hidden>{status.emoji}</span>
            {status.label}
          </span>
        </div>
      </div>

      <div className="engine-tab-content" key={view}>
        {view === "sim" && (
          <div className="sim-canvas-wrap sim-canvas-solo">
            <ScatterCanvas points={points} engine={engine} />
            {showResult && (
              <div className="result-overlay">
                <div className="result-card">
                  <button
                    className="result-card-close"
                    onClick={() => setDismissedAtIteration(engine.iteration)}
                    aria-label="Fechar"
                  >
                    <X size={16} />
                  </button>
                  <div className="result-card-header">
                    <div className="result-card-title">Convergiu</div>
                    <div className="result-card-sub">{engine.iteration} iterações</div>
                  </div>
                  {engineName === "cpu" ? (
                    <CpuStatsPanel stats={engine.stats as import("../lib/types").CpuStats} />
                  ) : (
                    <GpuStatsPanel stats={engine.stats as GpuStats} />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {view === "code" && <CodePanel engine={engineName} iteration={engine.iteration} />}
        {view === "arch" && <CudaArchViz stats={engine.stats as GpuStats | null} numPoints={numPoints ?? 0} />}
      </div>
    </div>
  );
}
