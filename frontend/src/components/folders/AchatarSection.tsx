import { useState } from "react";
import { FolderInput } from "../ui/FolderInput";
import { ProgressBar } from "../ui/ProgressBar";
import { apiFlattenFolder, apiCancelFolder } from "../../lib/api";
import type { WsProgressMessage } from "../../hooks/useWebSocket";
import { Play, Square, FolderOutput } from "lucide-react";

interface Props {
  progressMap: Record<string, WsProgressMessage>;
  onLog: (msg: string, nivel: string) => void;
}

export function AchatarSection({ progressMap, onLog }: Props) {
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [mover, setMover] = useState(false);
  const [preservarOrdem, setPreservarOrdem] = useState(true);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const progress = taskId ? (progressMap[taskId] ?? null) : null;

  const handleFlatten = async () => {
    if (!origem || !destino) {
      onLog("⚠️ Selecione as pastas de origem e destino!", "warn");
      return;
    }
    try {
      setLoading(true);
      const res = await apiFlattenFolder({ pasta_origem: origem, pasta_destino: destino, mover, preservar_ordem: preservarOrdem });
      setTaskId(res.task_id);
      onLog(`▶ ${res.message}`, "info");
    } catch (err) {
      onLog(`❌ Erro: ${err}`, "erro");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (taskId) {
      await apiCancelFolder(taskId);
      onLog("⏹ Cancelamento solicitado.", "warn");
      setTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-violet-500/10 p-3">
          <FolderOutput className="h-6 w-6 text-violet-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Achatar Pastas</h3>
          <p className="text-sm text-muted-foreground">Reúne todos os arquivos de subpastas em uma única pasta.</p>
        </div>
      </div>

      <FolderInput label="Pasta de origem (com subpastas)" value={origem} onChange={setOrigem} icon="📂" accentColor="text-violet-400" />
      <FolderInput label="Pasta de destino (pasta única)" value={destino} onChange={setDestino} icon="📥" accentColor="text-emerald-400" />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMover((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${mover ? "bg-violet-600" : "bg-slate-600"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${mover ? "translate-x-6" : "translate-x-1"}`} />
        </button>
        <span className="text-sm text-muted-foreground">
          {mover ? <span className="text-amber-400 font-medium">Mover arquivos (remove os originais)</span> : "Copiar arquivos (mantém os originais)"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setPreservarOrdem((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${preservarOrdem ? "bg-violet-600" : "bg-slate-600"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${preservarOrdem ? "translate-x-6" : "translate-x-1"}`} />
        </button>
        <span className="text-sm text-muted-foreground">
          {preservarOrdem ? <span className="text-violet-300 font-medium">Preservar ordem (prefixo de pasta)</span> : "Sem prefixo (só o nome do arquivo)"}
        </span>
      </div>

      <div className="rounded-xl border border-dashed border-violet-500/30 bg-violet-500/5 p-4 space-y-2">
        {preservarOrdem ? (
          <>
            <p className="text-sm text-violet-300/80">📚 <strong>Ideal para cursos:</strong> o nome da pasta vira prefixo do arquivo.</p>
            <p className="text-xs text-muted-foreground font-mono">Módulo 1/Aula 01.mp4 → <span className="text-violet-400">Módulo 1 - Aula 01.mp4</span></p>
            <p className="text-xs text-muted-foreground font-mono">Módulo 2/Aula 01.mp4 → <span className="text-violet-400">Módulo 2 - Aula 01.mp4</span></p>
          </>
        ) : (
          <p className="text-sm text-violet-300/80">
            💡 Nomes duplicados recebem sufixo <code className="text-violet-400/80">_2</code>, <code className="text-violet-400/80">_3</code>, etc.
          </p>
        )}
      </div>

      <ProgressBar progress={progress} accentColor="bg-violet-500" />

      <div className="flex gap-3">
        <button
          onClick={handleFlatten}
          disabled={loading || !!taskId}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-6 py-3
                     text-sm font-semibold text-white hover:bg-violet-700 active:bg-violet-800
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <Play className="h-4 w-4" />
          ACHATAR PASTAS
        </button>
        {taskId && (
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 rounded-lg bg-red-600/20 px-6 py-3 text-sm font-semibold text-red-400 hover:bg-red-600/30 transition-all"
          >
            <Square className="h-4 w-4" />
            PARAR
          </button>
        )}
      </div>
    </div>
  );
}
