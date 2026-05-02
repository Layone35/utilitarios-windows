import { useState } from "react";
import { FolderInput } from "../ui/FolderInput";
import { ProgressBar } from "../ui/ProgressBar";
import { apiExtractArchives, apiCancelFolder } from "../../lib/api";
import type { WsProgressMessage } from "../../hooks/useWebSocket";
import { Play, Square, FileArchive } from "lucide-react";

interface Props {
  progressMap: Record<string, WsProgressMessage>;
  onLog: (msg: string, nivel: string) => void;
}

export function ExtratorSection({ progressMap, onLog }: Props) {
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [incluirSubpastas, setIncluirSubpastas] = useState(true);

  const progress = taskId ? (progressMap[taskId] ?? null) : null;

  const handleExtract = async () => {
    if (!origem || !destino) {
      onLog("⚠️ Selecione as pastas de origem e destino!", "warn");
      return;
    }
    try {
      setLoading(true);
      const res = await apiExtractArchives({ pasta_origem: origem, pasta_destino: destino, incluir_subpastas: incluirSubpastas });
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
        <div className="rounded-full bg-orange-500/10 p-3">
          <FileArchive className="h-6 w-6 text-orange-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Extrator de Arquivos</h3>
          <p className="text-sm text-muted-foreground">Extrai arquivos ZIP, RAR, 7z e TAR automaticamente.</p>
        </div>
      </div>

      <FolderInput label="Pasta com arquivos compactados" value={origem} onChange={setOrigem} icon="📦" accentColor="text-orange-400" />
      <FolderInput label="Pasta de destino" value={destino} onChange={setDestino} icon="📥" accentColor="text-emerald-400" />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIncluirSubpastas((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${incluirSubpastas ? "bg-orange-600" : "bg-slate-600"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${incluirSubpastas ? "translate-x-6" : "translate-x-1"}`} />
        </button>
        <span className="text-sm text-muted-foreground">
          {incluirSubpastas ? "Incluindo arquivos em subpastas" : "Apenas pasta principal (sem subpastas)"}
        </span>
      </div>

      <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-4">
        <p className="text-sm text-amber-300/80">
          💡 <strong>Formatos suportados:</strong> .zip, .rar, .7z, .tar, .tar.gz, .tgz, .bz2, .xz
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Para .rar e .7z é necessário ter <code className="text-amber-400/80">7-Zip</code> instalado.
        </p>
      </div>

      <ProgressBar progress={progress} accentColor="bg-orange-500" />

      <div className="flex gap-3">
        <button
          onClick={handleExtract}
          disabled={loading || !!taskId}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-6 py-3
                     text-sm font-semibold text-white hover:bg-orange-700 active:bg-orange-800
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <Play className="h-4 w-4" />
          EXTRAIR ARQUIVOS
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
