import type { GpuStats } from "../lib/types";

const MAX_BLOCKS_SHOWN = 6;
const MAX_THREADS_SHOWN_PER_BLOCK = 100;

function ArchStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="cuda-stat">
      <div className="cuda-stat-value">{value}</div>
      <div className="cuda-stat-label">{label}</div>
    </div>
  );
}

export function CudaArchViz({ stats, numPoints }: { stats: GpuStats | null; numPoints: number }) {
  if (!stats) {
    return (
      <div className="cuda-arch-viz cuda-arch-empty">
        Inicie a execução para ver a distribuição Grid → Block → Thread.
      </div>
    );
  }

  const { grid_size, block_size, threads_launched } = stats;
  const blocksShown = Math.min(grid_size, MAX_BLOCKS_SHOWN);
  const threadsShown = Math.min(block_size, MAX_THREADS_SHOWN_PER_BLOCK);
  const cols = Math.ceil(Math.sqrt(threadsShown));

  return (
    <div className="cuda-arch-viz">
      <div className="cuda-arch-stats">
        <ArchStat value={grid_size.toLocaleString("pt-BR")} label="Blocks no grid" />
        <ArchStat value={block_size.toLocaleString("pt-BR")} label="Threads por block" />
        <ArchStat value={threads_launched.toLocaleString("pt-BR")} label="Threads lançadas" />
        <ArchStat value={numPoints.toLocaleString("pt-BR")} label="Pontos a processar" />
      </div>

      <p className="cuda-arch-explainer">
        A GPU divide os {numPoints.toLocaleString("pt-BR")} pontos entre milhares de threads que rodam ao mesmo
        tempo. Cada thread cuida de <strong>1 ponto</strong>; as threads são agrupadas em <strong>blocks</strong>,
        e todos os blocks juntos formam o <strong>grid</strong> lançado na GPU.
      </p>

      <div className="cuda-grid-frame">
        <span className="cuda-grid-frame-label">GRID · {grid_size.toLocaleString("pt-BR")} blocks</span>
        <div className="cuda-blocks-row">
          {Array.from({ length: blocksShown }).map((_, b) => (
            <div key={b} className="cuda-block">
              <div className="cuda-block-label">Block {b}</div>
              <div className="cuda-thread-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                {Array.from({ length: threadsShown }).map((_, t) => {
                  const globalThreadIdx = b * block_size + t;
                  const active = globalThreadIdx < numPoints;
                  return <div key={t} className={`cuda-thread ${active ? "active" : "idle"}`} />;
                })}
              </div>
              {block_size > threadsShown && <div className="cuda-block-more">+{block_size - threadsShown} threads</div>}
            </div>
          ))}
          {grid_size > blocksShown && (
            <div className="cuda-block cuda-block-more-blocks">+{(grid_size - blocksShown).toLocaleString("pt-BR")} blocks</div>
          )}
        </div>
      </div>

      <div className="cuda-arch-legend">
        <span>
          <span className="legend-dot legend-thread-active" /> thread processando um ponto
        </span>
        <span>
          <span className="legend-dot legend-thread-idle" /> thread ociosa (sobra do block)
        </span>
      </div>
    </div>
  );
}
