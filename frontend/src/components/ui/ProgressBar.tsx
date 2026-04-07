import { cn } from "../../lib/utils";
import type { WsProgressMessage } from "../../hooks/useWebSocket";

interface ProgressBarProps {
  progress: WsProgressMessage | null;
  accentColor?: string;
}

/**
 * Barra de progresso animada com mensagem de status.
 */
export function ProgressBar({
  progress,
  accentColor = "bg-primary",
}: ProgressBarProps) {
  if (!progress) return null;

  const pct = progress.total
    ? Math.round((progress.atual! / progress.total) * 100)
    : 0;

  return (
    <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground truncate max-w-[70%]">
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
    </div>
  );
}
