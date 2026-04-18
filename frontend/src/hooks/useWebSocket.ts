import { useEffect, useRef, useState, useCallback } from "react";

export interface WsProgressMessage {
  type: "progress" | "log" | "complete";
  task_id: string;
  atual?: number;
  total?: number;
  mensagem?: string;
  status?: string;
  nivel?: string;
  elapsed?: number;
  eta?: number;
}

export interface LogEntry {
  mensagem: string;
  nivel: string;
  timestamp: string;
}

/**
 * Hook para conexão WebSocket com reconexão automática.
 * Recebe mensagens de progresso e logs do backend.
 */
export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [progressMap, setProgressMap] = useState<Record<string, WsProgressMessage>>({});
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [taskComplete, setTaskComplete] = useState<WsProgressMessage | null>(
    null,
  );
  const retryDelayRef = useRef(1000);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket("ws://127.0.0.1:8010/ws/progress");

    ws.onopen = () => {
      setConnected(true);
      retryDelayRef.current = 1000;
    };

    ws.onmessage = (event) => {
      try {
        const data: WsProgressMessage = JSON.parse(event.data);

        if (data.type === "progress") {
          setProgressMap((prev) => ({ ...prev, [data.task_id]: data }));
        } else if (data.type === "log") {
          setLogs((prev) => [
            ...prev.slice(-99), // Manter últimas 100 entradas
            {
              mensagem: data.mensagem ?? "",
              nivel: data.nivel ?? "info",
              timestamp: new Date().toLocaleTimeString("pt-BR"),
            },
          ]);
        } else if (data.type === "complete") {
          setTaskComplete(data);
          setProgressMap((prev) => {
            const next = { ...prev };
            delete next[data.task_id];
            return next;
          });
        }
      } catch {
        // Ignora mensagens inválidas
      }
    };

    ws.onclose = () => {
      setConnected(false);
      const delay = retryDelayRef.current;
      retryDelayRef.current = Math.min(delay * 2, 30000);
      setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  const cancelTask = useCallback((taskId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(`cancel:${taskId}`);
    }
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const clearComplete = useCallback(() => {
    setTaskComplete(null);
  }, []);

  return {
    connected,
    progressMap,
    logs,
    taskComplete,
    cancelTask,
    clearLogs,
    clearComplete,
  };
}
