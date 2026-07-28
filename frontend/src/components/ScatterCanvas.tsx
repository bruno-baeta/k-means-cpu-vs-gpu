import { useEffect, useRef } from "react";
import { clusterColorCss } from "../lib/colors";
import { drawTrail, rasterizePoints } from "../lib/scatterRaster";
import type { EngineState } from "../store/useKMeansStore";

const DOMAIN = 100;
const POINT_RADIUS_PX = 1.2;

interface Props {
  points: Float32Array | null;
  engine: EngineState;
}

export function ScatterCanvas({ points, engine }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const redraw = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const imageData = rasterizePoints(canvas.width, canvas.height, points, engine.assignments, POINT_RADIUS_PX * dpr);
    ctx.imageSmoothingEnabled = false;
    ctx.putImageData(imageData, 0, 0);
    drawTrail(ctx, canvas.width, canvas.height, engine.trail);
  };

  const redrawRef = useRef(redraw);
  redrawRef.current = redraw;

  const frameScheduledRef = useRef(false);
  const scheduleRedraw = () => {
    if (frameScheduledRef.current) return;
    frameScheduledRef.current = true;
    requestAnimationFrame(() => {
      frameScheduledRef.current = false;
      redrawRef.current();
    });
  };

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      redrawRef.current();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(scheduleRedraw, [points, engine.assignments, engine.trail]);

  const centroidCount = engine.centroids ? engine.centroids.length / 2 : 0;

  return (
    <div className="scatter-panel" ref={containerRef}>
      <canvas ref={canvasRef} className="scatter-canvas" />
      <div className="centroid-layer">
        {Array.from({ length: centroidCount }, (_, c) => {
          const x = engine.centroids![c * 2];
          const y = engine.centroids![c * 2 + 1];
          return (
            <div
              key={c}
              className="centroid-dot"
              style={{
                left: `${(x / DOMAIN) * 100}%`,
                top: `${((DOMAIN - y) / DOMAIN) * 100}%`,
                background: clusterColorCss(c),
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
