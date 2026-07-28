import { create } from "zustand";
import type { FrameUpdate, PointsInitFrame } from "../lib/protocol";
import type { Config, CpuStats, EngineName, GpuInfo, GpuStats, RunState, ServerJsonMessage } from "../lib/types";

const TRAIL_LENGTH = 25;

export interface EngineState {
  iteration: number;
  centroids: Float32Array | null;
  assignments: Uint8Array | null;
  converged: boolean;
  stats: CpuStats | GpuStats | null;
  trail: Float32Array[];
}

function emptyEngineState(): EngineState {
  return {
    iteration: 0,
    centroids: null,
    assignments: null,
    converged: false,
    stats: null,
    trail: [],
  };
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

interface KMeansStore {
  status: ConnectionStatus;
  gpuAvailable: boolean;
  gpuInfo: GpuInfo | null;
  gpuError: string | null;
  runState: RunState;
  numPoints: number;
  points: Float32Array | null;
  config: Config;
  cpu: EngineState;
  gpu: EngineState;
  errorMessage: string | null;

  setStatus: (status: ConnectionStatus) => void;
  setRunState: (runState: RunState) => void;
  setConfig: (partial: Partial<Config>) => void;
  handleServerMessage: (msg: ServerJsonMessage) => void;
  applyPointsInit: (frame: PointsInitFrame) => void;
  applyFrameUpdate: (frame: FrameUpdate) => void;
}

export const defaultConfig: Config = {
  num_points: 150,
  k: 3,
  seed: 42,
  delay_ms: 1000,
  step_mode: false,
  block_size: 256,
};

export const useKMeansStore = create<KMeansStore>((set) => ({
  status: "disconnected",
  gpuAvailable: false,
  gpuInfo: null,
  gpuError: null,
  runState: "idle",
  numPoints: 0,
  points: null,
  config: defaultConfig,
  cpu: emptyEngineState(),
  gpu: emptyEngineState(),
  errorMessage: null,

  setStatus: (status) => set({ status }),

  setRunState: (runState) => set({ runState }),

  setConfig: (partial) => set((state) => ({ config: { ...state.config, ...partial } })),

  handleServerMessage: (msg) =>
    set((state) => {
      switch (msg.type) {
        case "ready":
          return { gpuAvailable: msg.gpu_available, gpuInfo: msg.gpu_info };

        case "configured":
          return {
            runState: "idle",
            gpuAvailable: msg.gpu_available,
            gpuError: msg.gpu_error,
            numPoints: msg.num_points,
            errorMessage: null,
            cpu: emptyEngineState(),
            gpu: emptyEngineState(),
            config: {
              ...state.config,
              num_points: msg.num_points,
              k: msg.k,
              seed: msg.seed,
              delay_ms: msg.delay_ms,
              step_mode: msg.step_mode,
            },
          };

        case "stats": {
          const engine: EngineName = msg.engine;
          return {
            [engine]: { ...state[engine], stats: msg, iteration: msg.iteration, converged: msg.converged },
            runState: state.runState === "idle" ? "running" : state.runState,
          } as Partial<KMeansStore>;
        }

        case "benchmark_result":
          return { runState: "finished" };

        case "error":
          return { errorMessage: msg.message };

        default:
          return {};
      }
    }),

  applyPointsInit: (frame) => set({ points: frame.points, numPoints: frame.n }),

  applyFrameUpdate: (frame) =>
    set((state) => {
      const engine = frame.engine;
      const prev = state[engine];
      const trail = [...prev.trail, frame.centroids].slice(-TRAIL_LENGTH);
      return {
        [engine]: {
          ...prev,
          iteration: frame.iteration,
          converged: frame.converged,
          centroids: frame.centroids,
          assignments: frame.assignments,
          trail,
        },
      } as Partial<KMeansStore>;
    }),
}));
