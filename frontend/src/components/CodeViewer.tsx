import { useEffect, useState } from "react";
import { highlightLine } from "../lib/highlight";
import type { EngineName } from "../lib/types";

type Phase = "idle" | "assign" | "update";

const PHASE_HIGHLIGHT_MS = 220;

function useHighlightPhase(iteration: number): Phase {
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (iteration === 0) return;

    setPhase("assign");
    const t1 = setTimeout(() => setPhase("update"), PHASE_HIGHLIGHT_MS);
    const t2 = setTimeout(() => setPhase("idle"), PHASE_HIGHLIGHT_MS * 2);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [iteration]);

  return phase;
}

interface SourceInfo {
  code: string;
  assign_range: [number, number];
  update_range: [number, number];
}

function useEngineSource(engine: EngineName): SourceInfo | null {
  const [source, setSource] = useState<SourceInfo | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const api = window.pywebview?.api;
      if (!api) return;
      const result = await api.get_source(engine);
      if (!cancelled && result) setSource(result);
    };

    if (window.pywebview) {
      load();
    } else {
      window.addEventListener("pywebviewready", load);
    }

    return () => {
      cancelled = true;
      window.removeEventListener("pywebviewready", load);
    };
  }, [engine]);

  return source;
}

function CodeBlock({
  code,
  phase,
  assignRange,
  updateRange,
}: {
  code: string;
  phase: Phase;
  assignRange: [number, number];
  updateRange: [number, number];
}) {
  const lines = code.split("\n");
  return (
    <pre className="code-block">
      {lines.map((line, i) => {
        const lineNo = i + 1;
        const inAssign = phase === "assign" && lineNo >= assignRange[0] && lineNo <= assignRange[1];
        const inUpdate = phase === "update" && lineNo >= updateRange[0] && lineNo <= updateRange[1];
        const cls = inAssign ? "code-line highlight-assign" : inUpdate ? "code-line highlight-update" : "code-line";
        return (
          <div key={i} className={cls}>
            <span className="code-line-no">{lineNo}</span>
            <code dangerouslySetInnerHTML={{ __html: highlightLine(line) || "&nbsp;" }} />
          </div>
        );
      })}
    </pre>
  );
}

const FILE_NAMES: Record<EngineName, string> = {
  cpu: "kmeans_cpu.py",
  gpu: "kmeans_kernel.cu",
};

export function CodePanel({ engine, iteration }: { engine: EngineName; iteration: number }) {
  const phase = useHighlightPhase(iteration);
  const source = useEngineSource(engine);

  return (
    <div className="code-panel">
      <div className="code-titlebar">
        <div className="code-titlebar-dots">
          <span className="code-dot code-dot-red" />
          <span className="code-dot code-dot-yellow" />
          <span className="code-dot code-dot-green" />
        </div>
        <span className="code-titlebar-name">{FILE_NAMES[engine]}</span>
      </div>
      {source ? (
        <CodeBlock
          code={source.code}
          phase={phase}
          assignRange={source.assign_range}
          updateRange={source.update_range}
        />
      ) : (
        <div className="code-block-loading">Carregando código...</div>
      )}
      <div className="code-viewer-legend">
        <span className="legend-dot legend-assign" /> fase de atribuição (assignment)
        <span className="legend-dot legend-update" /> fase de atualização (update)
      </div>
    </div>
  );
}
