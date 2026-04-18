import { cn } from "../../lib/utils";
import type { WsProgressMessage } from "../../hooks/useWebSocket";

interface ProgressBarProps {
  progress: WsProgressMessage | null;
  accentColor?: string;
}

function fmtTempo(seg: number): string {
  const s = Math.floor(seg);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m${String(rs).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h${String(rm).padStart(2, "0")}m${String(rs).padStart(2, "0")}s`;
}

export function ProgressBar({
  progress,
  accentColor = "bg-primary",
}: ProgressBarProps) {
  if (!progress) return null;

  const pct = progress.total
    ? Math.round((progress.atual! / progress.total) * 100)
    : 0;

  const hasTimer = progress.elapsed != null && progress.elapsed > 0;

  return (
    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground truncate max-w-[60%]">
          {progress.mensagem}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {progress.atual}/{progress.total} ({pct}%)
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 ease-out",
            accentColor,
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {hasTimer && (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground/70 font-mono">
          <span>⏱ {fmtTempo(progress.elapsed!)}</span>
          {progress.eta != null && progress.eta > 0 ? (
            <span>ETA ~{fmtTempo(progress.eta)}</span>
          ) : (
            <span>calculando ETA…</span>
          )}
        </div>
      )}
    </div>
  );
}
