export const CLUSTER_COLORS: [number, number, number][] = [
  [230, 25, 75],
  [60, 180, 75],
  [255, 196, 12],
  [0, 130, 200],
  [245, 130, 48],
  [145, 30, 180],
  [70, 240, 240],
  [240, 50, 230],
  [210, 245, 60],
  [250, 190, 190],
  [0, 128, 128],
  [220, 190, 255],
];

export function clusterColor(index: number): [number, number, number] {
  return CLUSTER_COLORS[index % CLUSTER_COLORS.length];
}

export function clusterColorCss(index: number): string {
  const [r, g, b] = clusterColor(index);
  return `rgb(${r}, ${g}, ${b})`;
}
