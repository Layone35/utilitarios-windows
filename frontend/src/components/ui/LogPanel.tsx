import { cn } from "../../lib/utils";
import type { LogEntry } from "../../hooks/useWebSocket";
import { Trash2 } from "lucide-react";
import { useRef, useEffect } from "react";

interface LogPanelProps {
  logs: LogEntry[];
  onClear: () => void;
}

const NIVEL_STYLES: Record<string, string> = {
  ok: "text-emerald-400",
  info: "text-blue-400",
  warn: "text-amber-400",
  erro: "text-red-400",
};

/**
 * Painel de log em tempo real com auto-scroll.
 */
export function LogPanel({ logs, onClear }: LogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-secondary/30">
        <span className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          📋 Log em Tempo Real
        </span>
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground
                     transition-colors px-2 py-1 rounded-md hover:bg-secondary"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Limpar
        </button>
      </div>
      <div
        ref={scrollRef}
        className="h-40 overflow-y-auto p-3 font-mono text-xs space-y-0.5 bg-[#0d1117]"
      >
        {logs.length === 0 ? (
          <span className="text-muted-foreground/40">Aguardando ações...</span>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-muted-foreground/50 shrink-0">
                {log.timestamp}
              </span>
              <span
                className={cn(NIVEL_STYLES[log.nivel] ?? "text-foreground")}
              >
                {log.mensagem}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
