export type EngineName = "cpu" | "gpu";
export type RunState = "idle" | "running" | "paused" | "finished";

export interface GpuInfo {
  name: string;
  sm_count: number;
  cuda_cores: number;
  compute_capability: string;
  vram_total_bytes: number;
}

export interface Config {
  num_points: number;
  k: number;
  seed: number;
  delay_ms: number;
  step_mode: boolean;
  block_size: number;
}

export interface CpuStats {
  type: "stats";
  engine: "cpu";
  iteration: number;
  assign_ms: number;
  update_ms: number;
  iter_ms: number;
  total_ms: number;
  converged: boolean;
  threads_used: number;
  logical_cores: number;
  system_cpu_percent: number;
  process_cpu_percent: number;
  process_ram_mb: number;
  system_ram_used_mb: number;
  system_ram_total_mb: number;
}

export interface GpuStats {
  type: "stats";
  engine: "gpu";
  iteration: number;
  assign_ms: number;
  update_ms: number;
  iter_ms: number;
  total_ms: number;
  converged: boolean;
  grid_size: number;
  block_size: number;
  threads_launched: number;
  gpu_util_percent: number;
  mem_util_percent: number;
  vram_used_mb: number;
  vram_total_mb: number;
}

export type EngineStats = CpuStats | GpuStats;

export interface BenchmarkResult {
  type: "benchmark_result";
  num_points: number;
  cpu_time_ms: number;
  cpu_iterations: number;
  cpu_throughput_points_per_s: number;
  gpu_time_ms: number | null;
  gpu_iterations: number | null;
  gpu_throughput_points_per_s: number | null;
  speedup: number | null;
}

export interface ReadyMessage {
  type: "ready";
  gpu_available: boolean;
  gpu_info: GpuInfo | null;
}

export interface ConfiguredMessage {
  type: "configured";
  num_points: number;
  k: number;
  seed: number;
  delay_ms: number;
  step_mode: boolean;
  gpu_available: boolean;
  gpu_error: string | null;
  max_iterations: number;
}

export interface ErrorMessage {
  type: "error";
  message: string;
}

export type ServerJsonMessage = ReadyMessage | ConfiguredMessage | EngineStats | BenchmarkResult | ErrorMessage;
