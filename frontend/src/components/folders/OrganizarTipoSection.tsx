import { useState } from "react";
import { FolderInput } from "../ui/FolderInput";
import { ProgressBar } from "../ui/ProgressBar";
import { apiOrganizeFolder, apiCancelOrganize } from "../../lib/api";
import type { WsProgressMessage } from "../../hooks/useWebSocket";
import { Play, Square, FolderKanban } from "lucide-react";

interface Props {
  progressMap: Record<string, WsProgressMessage>;
  onLog: (msg: string, nivel: string) => void;
}

export function OrganizarTipoSection({ progressMap, onLog }: Props) {
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [mover, setMover] = useState(false);
  const [subpastas, setSubpastas] = useState(true);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const progress = taskId ? (progressMap[taskId] ?? null) : null;

  const handleOrganize = async () => {
    if (!origem || !destino) {
      onLog("⚠️ Selecione as pastas de origem e destino!", "warn");
      return;
    }
    try {
      setLoading(true);
      const res = await apiOrganizeFolder({ pasta_origem: origem, pasta_destino: destino, mover, incluir_subpastas: subpastas });
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
      await apiCancelOrganize(taskId);
      onLog("⏹ Cancelamento solicitado.", "warn");
      setTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-sky-500/10 p-3">
          <FolderKanban className="h-6 w-6 text-sky-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Organizar por Tipo</h3>
          <p className="text-sm text-muted-foreground">
            Separa arquivos em pastas: Vídeos, Áudios, Imagens, Documentos...
          </p>
        </div>
      </div>

      <FolderInput label="Pasta de origem (bagunçada)" value={origem} onChange={setOrigem} icon="📂" accentColor="text-sky-400" />
      <FolderInput label="Pasta de destino (organizada)" value={destino} onChange={setDestino} icon="📥" accentColor="text-emerald-400" />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMover((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${mover ? "bg-sky-600" : "bg-slate-600"}`}
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
          onClick={() => setSubpastas((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${subpastas ? "bg-sky-600" : "bg-slate-600"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${subpastas ? "translate-x-6" : "translate-x-1"}`} />
        </button>
        <span className="text-sm text-muted-foreground">
          {subpastas ? "Incluindo arquivos em subpastas" : "Apenas pasta principal (sem subpastas)"}
        </span>
      </div>

      <div className="rounded-xl border border-dashed border-sky-500/30 bg-sky-500/5 p-4 space-y-1">
        <p className="text-sm text-sky-300/80">💡 <strong>Pastas criadas automaticamente:</strong></p>
        <p className="text-xs text-muted-foreground">Vídeos · Áudios · Imagens · Documentos · Compactados · Código · Programas · Outros</p>
      </div>

      <ProgressBar progress={progress} accentColor="bg-sky-500" />

      <div className="flex gap-3">
        <button
          onClick={handleOrganize}
          disabled={loading || !!taskId}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-6 py-3
                     text-sm font-semibold text-white hover:bg-sky-700 active:bg-sky-800
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <Play className="h-4 w-4" />
          ORGANIZAR ARQUIVOS
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
