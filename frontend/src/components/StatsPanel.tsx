import { Boxes, Clock, Gauge, Grid3x3, Hash, Layers, MemoryStick, Timer, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useAnimatedNumber } from "../lib/useAnimatedNumber";
import type { CpuStats, GpuStats } from "../lib/types";

function AnimatedMs({ value, decimals = 1 }: { value: number; decimals?: number }) {
  const animated = useAnimatedNumber(value, 450);
  if (animated >= 1000) {
    return <>{(animated / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} s</>;
  }
  return (
    <>
      {animated.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ms
    </>
  );
}

function AnimatedValue({ value, decimals = 0, suffix = "" }: { value: number; decimals?: number; suffix?: string }) {
  const animated = useAnimatedNumber(value, 450);
  return (
    <>
      {animated.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </>
  );
}

function fmtInt(value: number): string {
  return Math.round(value).toLocaleString("pt-BR");
}

function StatTile({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-value">{children}</div>
      <div className="stat-tile-label">
        <Icon size={12} strokeWidth={2.25} />
        {label}
      </div>
    </div>
  );
}

export function CpuStatsPanel({ stats }: { stats: CpuStats }) {
  return (
    <div className="stat-tile-grid">
      <StatTile icon={Clock} label="Tempo total">
        <AnimatedMs value={stats.total_ms} decimals={1} />
      </StatTile>
      <StatTile icon={Timer} label="Fase assign">
        <AnimatedMs value={stats.assign_ms} decimals={3} />
      </StatTile>
      <StatTile icon={Timer} label="Fase update">
        <AnimatedMs value={stats.update_ms} decimals={3} />
      </StatTile>
      <StatTile icon={Layers} label="Threads">
        {stats.threads_used}/{stats.logical_cores}
      </StatTile>
      <StatTile icon={Gauge} label="CPU (processo)">
        <AnimatedValue value={stats.process_cpu_percent} decimals={0} suffix="%" />
      </StatTile>
      <StatTile icon={Gauge} label="CPU (sistema)">
        <AnimatedValue value={stats.system_cpu_percent} decimals={0} suffix="%" />
      </StatTile>
      <StatTile icon={MemoryStick} label="RAM (processo)">
        {fmtInt(stats.process_ram_mb)} MB
      </StatTile>
      <StatTile icon={MemoryStick} label="RAM (sistema)">
        {fmtInt(stats.system_ram_used_mb)}/{fmtInt(stats.system_ram_total_mb)} MB
      </StatTile>
    </div>
  );
}

export function GpuStatsPanel({ stats }: { stats: GpuStats }) {
  return (
    <div className="stat-tile-grid">
      <StatTile icon={Clock} label="Tempo total">
        <AnimatedMs value={stats.total_ms} decimals={1} />
      </StatTile>
      <StatTile icon={Timer} label="Kernel assign">
        <AnimatedMs value={stats.assign_ms} decimals={4} />
      </StatTile>
      <StatTile icon={Timer} label="Kernel update">
        <AnimatedMs value={stats.update_ms} decimals={4} />
      </StatTile>
      <StatTile icon={Hash} label="Threads lançadas">
        {fmtInt(stats.threads_launched)}
      </StatTile>
      <StatTile icon={Boxes} label="Block size">
        {fmtInt(stats.block_size)}
      </StatTile>
      <StatTile icon={Grid3x3} label="Grid size">
        {fmtInt(stats.grid_size)}
      </StatTile>
      <StatTile icon={Gauge} label="Uso da GPU">
        <AnimatedValue value={stats.gpu_util_percent} decimals={0} suffix="%" />
      </StatTile>
      <StatTile icon={MemoryStick} label="VRAM">
        {fmtInt(stats.vram_used_mb)}/{fmtInt(stats.vram_total_mb)} MB
      </StatTile>
    </div>
  );
}
