import { CLUSTER_COLORS, clusterColor } from "./colors";

const DOMAIN = 100;
const BACKGROUND: [number, number, number] = [15, 17, 24];
const IDLE_COLOR: [number, number, number] = [88, 94, 110];

function toPixel(value: number, size: number): number {
  return Math.min(size - 1, Math.max(0, Math.floor((value / DOMAIN) * (size - 1))));
}

function packRGBA(r: number, g: number, b: number, a: number): number {
  return (a << 24) | (b << 16) | (g << 8) | r;
}

function circleOffsets(radiusPx: number): Int32Array {
  const radius = Math.max(0.75, radiusPx);
  const ceil = Math.ceil(radius);
  const offsets: number[] = [];
  for (let oy = -ceil; oy <= ceil; oy++) {
    for (let ox = -ceil; ox <= ceil; ox++) {
      if (ox * ox + oy * oy <= radius * radius) {
        offsets.push(ox, oy);
      }
    }
  }
  return Int32Array.from(offsets);
}

function buildPalette(): Uint32Array {
  const palette = new Uint32Array(CLUSTER_COLORS.length);
  for (let i = 0; i < CLUSTER_COLORS.length; i++) {
    const [r, g, b] = clusterColor(i);
    palette[i] = packRGBA(r, g, b, 255);
  }
  return palette;
}

export function rasterizePoints(
  width: number,
  height: number,
  points: Float32Array | null,
  assignments: Uint8Array | null,
  pointRadiusPx: number,
): ImageData {
  const imageData = new ImageData(width, height);
  const pixels32 = new Uint32Array(imageData.data.buffer);
  pixels32.fill(packRGBA(BACKGROUND[0], BACKGROUND[1], BACKGROUND[2], 255));

  if (!points) return imageData;

  const offsets = circleOffsets(pointRadiusPx);
  const numOffsets = offsets.length / 2;
  const palette = buildPalette();
  const paletteSize = palette.length;
  const idleColor = packRGBA(IDLE_COLOR[0], IDLE_COLOR[1], IDLE_COLOR[2], 255);

  const n = points.length / 2;
  for (let i = 0; i < n; i++) {
    const px = toPixel(points[i * 2], width);
    const py = toPixel(DOMAIN - points[i * 2 + 1], height);
    const color = assignments ? palette[assignments[i] % paletteSize] : idleColor;

    for (let o = 0; o < numOffsets; o++) {
      const xx = px + offsets[o * 2];
      const yy = py + offsets[o * 2 + 1];
      if (xx < 0 || xx >= width || yy < 0 || yy >= height) continue;
      pixels32[yy * width + xx] = color;
    }
  }
  return imageData;
}

export function drawTrail(ctx: CanvasRenderingContext2D, width: number, height: number, trail: Float32Array[]) {
  if (trail.length < 2) return;
  const k = trail[0].length / 2;
  for (let c = 0; c < k; c++) {
    ctx.beginPath();
    trail.forEach((snapshot, i) => {
      const x = (snapshot[c * 2] / DOMAIN) * width;
      const y = ((DOMAIN - snapshot[c * 2 + 1]) / DOMAIN) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    const [r, g, b] = clusterColor(c);
    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.5)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
