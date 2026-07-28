import type { EngineName } from "./types";

export const MSG_POINTS_INIT = 1;
export const MSG_FRAME_UPDATE = 2;

export interface PointsInitFrame {
  kind: typeof MSG_POINTS_INIT;
  n: number;
  points: Float32Array;
}

export interface FrameUpdate {
  kind: typeof MSG_FRAME_UPDATE;
  engine: EngineName;
  iteration: number;
  converged: boolean;
  k: number;
  centroids: Float32Array;
  assignments: Uint8Array;
}

export function decodeBinaryFrame(buf: ArrayBuffer): PointsInitFrame | FrameUpdate {
  const view = new DataView(buf);
  const msgType = view.getUint8(0);

  if (msgType === MSG_POINTS_INIT) {
    const n = view.getUint32(1, true);
    const points = new Float32Array(buf.slice(5, 5 + n * 2 * 4));
    return { kind: MSG_POINTS_INIT, n, points };
  }

  if (msgType === MSG_FRAME_UPDATE) {
    const engineByte = view.getUint8(1);
    const converged = view.getUint8(2) !== 0;
    const iteration = view.getUint32(3, true);
    const k = view.getUint32(7, true);
    const centroidsBytes = k * 2 * 4;
    const centroids = new Float32Array(buf.slice(11, 11 + centroidsBytes));
    const assignments = new Uint8Array(buf.slice(11 + centroidsBytes));
    return {
      kind: MSG_FRAME_UPDATE,
      engine: engineByte === 0 ? "cpu" : "gpu",
      iteration,
      converged,
      k,
      centroids,
      assignments,
    };
  }

  throw new Error(`unknown binary frame type ${msgType}`);
}
