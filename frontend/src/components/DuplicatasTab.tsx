import { useState, useEffect } from "react";
import { cn } from "../lib/utils";
import { FolderInput } from "./ui/FolderInput";
import { ProgressBar } from "./ui/ProgressBar";
import { apiDuplicatasScan, apiDuplicatasResultado, apiCancelDuplicatas } from "../lib/api";
import type { DuplicatasResultado } from "../lib/api";
import type { WsProgressMessage } from "../hooks/useWebSocket";
import { FolderSearch, Loader2, Square } from "lucide-react";
import { DuplicatasResultados } from "./duplicatas/DuplicatasResultados";

interface DuplicatasTabProps {
  progressMap: Record<string, WsProgressMessage>;
  taskComplete: WsProgressMessage | null;
  onLog: (msg: string, nivel: string) => void;
}

export function DuplicatasTab({ progressMap, taskComplete, onLog }: DuplicatasTabProps) {
  const [pasta, setPasta] = useState("");
  const [recursivo, setRecursivo] = useState(true);
  const [modo, setModo] = useState("3");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<DuplicatasResultado | null>(null);

  const progress = taskId ? (progressMap[taskId] ?? null) : null;

  useEffect(() => {
    if (taskComplete && taskComplete.task_id === taskId) {
      apiDuplicatasResultado(taskComplete.task_id)
        .then((res) => { setResultado(res); })
        .catch(() => onLog("❌ Erro ao buscar resultados.", "erro"))
        .finally(() => setTaskId(null));
    }
  }, [taskComplete, taskId, onLog]);

  const handleScan = async () => {
    if (!pasta.trim()) { onLog("⚠️ Informe a pasta para escanear.", "warn"); return; }
    try {
      setLoading(true);
      setResultado(null);
      const res = await apiDuplicatasScan({ pasta: pasta.trim(), recursivo, modo });
      setTaskId(res.task_id);
      onLog(`▶ ${res.message}`, "info");
    } catch (err) {
      onLog(`❌ Erro: ${err}`, "erro");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (taskId) { await apiCancelDuplicatas(taskId); onLog("⏹ Cancelamento solicitado.", "warn"); setTaskId(null); }
  };

  const modos = [
    { value: "1", label: "Duplicatas exatas", desc: "Mesmo conteúdo (MD5)" },
    { value: "2", label: "Famílias por nome", desc: "Ex: relatorio.pdf + relatorio_assinado.pdf" },
    { value: "3", label: "Ambos", desc: "Exatas + famílias" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-amber-500/10 p-3">
          <FolderSearch className="h-6 w-6 text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Scanner de Duplicatas</h3>
          <p className="text-sm text-muted-foreground">Encontra arquivos duplicados ou com nomes relacionados para liberar espaço.</p>
        </div>
      </div>

      <FolderInput label="Pasta para Escanear" value={pasta} onChange={setPasta} icon="📂" accentColor="text-amber-400" />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setRecursivo((v) => !v)}
          className={cn("relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200", recursivo ? "bg-amber-500" : "bg-secondary")}
        >
          <span className={cn("pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200", recursivo ? "translate-x-5" : "translate-x-0")} />
        </button>
        <span className="text-sm text-muted-foreground">Incluir subpastas</span>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-amber-400">Modo de Busca</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {modos.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setModo(m.value)}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition-all",
                modo === m.value ? "border-amber-500 bg-amber-500/10 text-amber-300" : "border-border bg-secondary/30 text-muted-foreground hover:border-amber-500/40",
              )}
            >
              <div className="font-medium">{m.label}</div>
              <div className="text-xs mt-0.5 opacity-70">{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <ProgressBar progress={progress} accentColor="bg-amber-500" />

      <div className="flex gap-3">
        <button
          onClick={handleScan}
          disabled={loading || !!taskId || !pasta.trim()}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-6 py-3
                     text-sm font-semibold text-white hover:bg-amber-700 active:bg-amber-800
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderSearch className="h-4 w-4" />}
          ESCANEAR PASTA
        </button>
        {taskId && (
          <button onClick={handleCancel} className="flex items-center gap-2 rounded-lg bg-red-600/20 px-6 py-3 text-sm font-semibold text-red-400 hover:bg-red-600/30 transition-all">
            <Square className="h-4 w-4" />
            PARAR
          </button>
        )}
      </div>

      {resultado && (
        <DuplicatasResultados
          resultado={resultado}
          onLog={onLog}
          onResultadoChange={setResultado}
        />
      )}
    </div>
  );
}
