import { ChartScatter, Cpu, Target, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import "./App.css";
import { ConfigModal } from "./components/ConfigModal";
import { EngineColumn } from "./components/EngineColumn";
import { Toolbar } from "./components/Toolbar";
import { WindowControls } from "./components/WindowControls";
import { useKMeansBridge } from "./hooks/useKMeansBridge";
import { useWindowChrome } from "./hooks/useWindowChrome";
import { useKMeansStore } from "./store/useKMeansStore";

function App() {
  const socket = useKMeansBridge();
  const { onHeaderMouseDown } = useWindowChrome();
  const status = useKMeansStore((s) => s.status);
  const gpuAvailable = useKMeansStore((s) => s.gpuAvailable);
  const gpuInfo = useKMeansStore((s) => s.gpuInfo);
  const gpuError = useKMeansStore((s) => s.gpuError);
  const config = useKMeansStore((s) => s.config);
  const runState = useKMeansStore((s) => s.runState);
  const points = useKMeansStore((s) => s.points);
  const cpu = useKMeansStore((s) => s.cpu);
  const gpu = useKMeansStore((s) => s.gpu);
  const errorMessage = useKMeansStore((s) => s.errorMessage);
  const setConfig = useKMeansStore((s) => s.setConfig);
  const setRunState = useKMeansStore((s) => s.setRunState);

  const [configOpen, setConfigOpen] = useState(false);

  const handleApply = () => {
    const seed = Math.floor(Math.random() * 1_000_000);
    setConfig({ seed });
    socket.configure({ ...config, seed });
  };

  useEffect(() => {
    if (status === "connected") {
      handleApply();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleStart = () => {
    socket.start();
    setRunState("running");
  };
  const handlePause = () => {
    socket.pause();
    setRunState("paused");
  };
  const handleResume = () => {
    socket.resume();
    setRunState("running");
  };
  const handleReset = () => socket.reset();

  const numPoints = points ? points.length / 2 : 0;

  return (
    <div className="app-shell">
      <header className="app-header" onMouseDown={onHeaderMouseDown}>
        <div className="app-brand">
          <div className="app-logo">
            <Zap size={20} />
          </div>
          <div>
            <h1>K-Means CPU × GPU (CUDA)</h1>
          </div>
        </div>
        <div className="app-header-right">
          <span className="dataset-chip">
            <ChartScatter size={14} />
            <strong>{numPoints.toLocaleString("pt-BR")}</strong> pontos
            <span className="dataset-chip-sep" />
            <Target size={14} />
            <strong>{config.k} centroides</strong>
          </span>
          {gpuAvailable && gpuInfo && (
            <span className="gpu-chip">
              <Cpu size={14} />
              {gpuInfo.name}
            </span>
          )}
          <Toolbar
            runState={runState}
            connected={status === "connected"}
            onStart={handleStart}
            onPause={handlePause}
            onResume={handleResume}
            onReset={handleReset}
            onOpenConfig={() => setConfigOpen(true)}
          />
          <WindowControls />
        </div>
      </header>

      {errorMessage && <div className="app-banner app-error">{errorMessage}</div>}
      {gpuError && <div className="app-banner app-warning">GPU indisponível: {gpuError}</div>}

      <div className="engines-grid">
        <EngineColumn
          engineName="cpu"
          label="CPU"
          icon={Cpu}
          accent="#38bdf8"
          points={points}
          engine={cpu}
          runState={runState}
        />
        <EngineColumn
          engineName="gpu"
          label="GPU (CUDA)"
          icon={Zap}
          accent="#22c55e"
          points={points}
          engine={gpu}
          runState={runState}
          numPoints={numPoints}
        />
      </div>

      {configOpen && (
        <ConfigModal config={config} onChange={setConfig} onApply={handleApply} onClose={() => setConfigOpen(false)} />
      )}
    </div>
  );
}

export default App;
