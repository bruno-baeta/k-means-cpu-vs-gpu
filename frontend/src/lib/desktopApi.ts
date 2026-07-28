import type { Config } from "./types";

export interface DesktopApi {
  ready(): Promise<{ gpu_available: boolean; gpu_info: unknown }>;
  configure(cfg: Config): Promise<Record<string, unknown>>;
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  step(): Promise<void>;
  reset(): Promise<Record<string, unknown> | null>;
  get_stats(engine: "cpu" | "gpu"): Promise<Record<string, unknown> | null>;
  get_source(engine: "cpu" | "gpu"): Promise<{ code: string; assign_range: [number, number]; update_range: [number, number] } | null>;
  get_benchmark_result(): Promise<Record<string, unknown> | null>;
  window_begin_drag(): Promise<void>;
  window_minimize(): Promise<void>;
  window_toggle_maximize(): Promise<void>;
  window_close(): Promise<void>;
}

declare global {
  interface Window {
    pywebview?: { api: DesktopApi };
  }
}
