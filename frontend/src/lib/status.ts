import type { RunState } from "./types";

export type StatusTone = "idle" | "running" | "paused" | "done";

export interface StatusInfo {
  emoji: string;
  label: string;
  tone: StatusTone;
}

export function engineStatusInfo(runState: RunState, converged: boolean): StatusInfo {
  if (converged) return { emoji: "🟢", label: "Concluído", tone: "done" };
  if (runState === "running") return { emoji: "🟡", label: "Executando", tone: "running" };
  if (runState === "paused") return { emoji: "⏸", label: "Pausado", tone: "paused" };
  return { emoji: "⚪", label: "Aguardando", tone: "idle" };
}
