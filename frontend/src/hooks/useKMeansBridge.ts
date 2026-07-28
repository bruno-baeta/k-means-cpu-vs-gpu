import { useCallback, useEffect, useRef } from "react";
import { decodeBinaryFrame, MSG_FRAME_UPDATE, MSG_POINTS_INIT } from "../lib/protocol";
import type { DesktopApi } from "../lib/desktopApi";
import type { Config } from "../lib/types";
import { useKMeansStore } from "../store/useKMeansStore";

const API_BASE = `${location.protocol}//${location.host}`;

async function fetchFrame(engine: "cpu" | "gpu") {
  const res = await fetch(`${API_BASE}/api/frame/${engine}`);
  if (res.status === 204) return null;
  const buf = await res.arrayBuffer();
  const frame = decodeBinaryFrame(buf);
  return frame.kind === MSG_FRAME_UPDATE ? frame : null;
}

function reportError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  useKMeansStore.getState().handleServerMessage({ type: "error", message } as never);
}

export function useKMeansBridge() {
  const apiRef = useRef<DesktopApi | null>(null);
  const pollingRef = useRef(false);
  const statsFetchedRef = useRef<{ cpu: number; gpu: number }>({ cpu: -1, gpu: -1 });

  const poll = useCallback(async () => {
    if (!pollingRef.current) return;
    const api = apiRef.current;
    if (api) {
      const [cpuFrame, gpuFrame, benchmark] = await Promise.all([
        fetchFrame("cpu"),
        fetchFrame("gpu"),
        api.get_benchmark_result(),
      ]);

      for (const [engine, frame] of [
        ["cpu", cpuFrame],
        ["gpu", gpuFrame],
      ] as const) {
        if (!frame) continue;
        useKMeansStore.getState().applyFrameUpdate(frame);
        if (frame.converged && statsFetchedRef.current[engine] !== frame.iteration) {
          statsFetchedRef.current[engine] = frame.iteration;
          const stats = await api.get_stats(engine);
          if (stats) useKMeansStore.getState().handleServerMessage({ type: "stats", ...stats } as never);
        }
      }

      if (benchmark) {
        useKMeansStore.getState().handleServerMessage({ type: "benchmark_result", ...benchmark } as never);
      }
    }
    requestAnimationFrame(poll);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const onReady = async () => {
      if (cancelled || !window.pywebview) return;
      apiRef.current = window.pywebview.api;
      useKMeansStore.getState().setStatus("connected");
      const info = await apiRef.current.ready();
      useKMeansStore.getState().handleServerMessage({ type: "ready", ...info } as never);
      pollingRef.current = true;
      requestAnimationFrame(poll);
    };

    if (window.pywebview) {
      onReady();
    } else {
      window.addEventListener("pywebviewready", onReady);
    }

    return () => {
      cancelled = true;
      pollingRef.current = false;
      window.removeEventListener("pywebviewready", onReady);
    };
  }, [poll]);

  const applyConfigured = useCallback(async (configured: Record<string, unknown> | null) => {
    if (!configured) return;
    statsFetchedRef.current = { cpu: -1, gpu: -1 };
    useKMeansStore.getState().handleServerMessage({ type: "configured", ...configured } as never);
    const res = await fetch(`${API_BASE}/api/points`);
    if (res.status === 204) return;
    const frame = decodeBinaryFrame(await res.arrayBuffer());
    if (frame.kind === MSG_POINTS_INIT) {
      useKMeansStore.getState().applyPointsInit(frame);
    }
  }, []);

  const configure = useCallback(
    async (cfg: Config) => {
      const api = apiRef.current;
      if (!api) return;
      pollingRef.current = false;
      try {
        await applyConfigured(await api.configure(cfg));
      } catch (err) {
        reportError(err);
      } finally {
        pollingRef.current = true;
        requestAnimationFrame(poll);
      }
    },
    [applyConfigured, poll],
  );

  const reset = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    pollingRef.current = false;
    try {
      await applyConfigured(await api.reset());
    } catch (err) {
      reportError(err);
    } finally {
      pollingRef.current = true;
      requestAnimationFrame(poll);
    }
  }, [applyConfigured, poll]);

  return {
    configure,
    start: () => apiRef.current?.start(),
    pause: () => apiRef.current?.pause(),
    resume: () => apiRef.current?.resume(),
    step: () => apiRef.current?.step(),
    reset,
  };
}
