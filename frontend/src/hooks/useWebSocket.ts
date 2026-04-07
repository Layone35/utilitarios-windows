import { useEffect, useRef, useState, useCallback } from "react";

export interface WsProgressMessage {
  type: "progress" | "log" | "complete";
  task_id: string;
  atual?: number;
  total?: number;
  mensagem?: string;
  status?: string;
  nivel?: string;
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
  const [progress, setProgress] = useState<WsProgressMessage | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [taskComplete, setTaskComplete] = useState<WsProgressMessage | null>(
    null,
  );

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket("ws://127.0.0.1:8000/ws/progress");

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data: WsProgressMessage = JSON.parse(event.data);

        if (data.type === "progress") {
          setProgress(data);
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
          setProgress(null);
        }
      } catch {
        // Ignora mensagens inválidas
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Reconectar após 3s
      setTimeout(connect, 3000);
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
    progress,
    logs,
    taskComplete,
    cancelTask,
    clearLogs,
    clearComplete,
  };
}
