import { useState } from "react";
import { FolderInput } from "../ui/FolderInput";
import { ProgressBar } from "../ui/ProgressBar";
import { apiOrganizePorData, apiCancelOrganizePorData } from "../../lib/api";
import type { WsProgressMessage } from "../../hooks/useWebSocket";
import { Play, Square, CalendarDays } from "lucide-react";

interface Props {
  progressMap: Record<string, WsProgressMessage>;
  onLog: (msg: string, nivel: string) => void;
}

export function OrganizarDataSection({ progressMap, onLog }: Props) {
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [mover, setMover] = useState(false);
  const [subpastas, setSubpastas] = useState(true);
  const [fallback, setFallback] = useState(true);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const progress = taskId ? (progressMap[taskId] ?? null) : null;

  const handleOrganizar = async () => {
    if (!origem || !destino) {
      onLog("⚠️ Selecione as pastas de origem e destino!", "warn");
      return;
    }
    try {
      setLoading(true);
      const res = await apiOrganizePorData({
        pasta_origem: origem,
        pasta_destino: destino,
        mover,
        incluir_subpastas: subpastas,
        fallback_data_arquivo: fallback,
      });
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
      await apiCancelOrganizePorData(taskId);
      onLog("⏹ Cancelamento solicitado.", "warn");
      setTaskId(null);
    }
  };

  const Toggle = ({ value, onToggle, color }: { value: boolean; onToggle: () => void; color: string }) => (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${value ? color : "bg-slate-600"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-teal-500/10 p-3">
          <CalendarDays className="h-6 w-6 text-teal-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Organizar por Data</h3>
          <p className="text-sm text-muted-foreground">Separa fotos e vídeos em pastas por ano e mês.</p>
        </div>
      </div>

      <FolderInput label="Pasta com fotos/vídeos (bagunçados)" value={origem} onChange={setOrigem} icon="📷" accentColor="text-teal-400" />
      <FolderInput label="Pasta de destino (organizada)" value={destino} onChange={setDestino} icon="📥" accentColor="text-emerald-400" />

      <div className="flex items-center gap-3">
        <Toggle value={mover} onToggle={() => setMover((v) => !v)} color="bg-teal-600" />
        <span className="text-sm text-muted-foreground">
          {mover ? <span className="text-amber-400 font-medium">Mover arquivos (remove os originais)</span> : "Copiar arquivos (mantém os originais)"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Toggle value={subpastas} onToggle={() => setSubpastas((v) => !v)} color="bg-teal-600" />
        <span className="text-sm text-muted-foreground">
          {subpastas ? "Incluindo arquivos em subpastas" : "Apenas pasta principal (sem subpastas)"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Toggle value={fallback} onToggle={() => setFallback((v) => !v)} color="bg-teal-600" />
        <span className="text-sm text-muted-foreground">
          {fallback ? "Usar data do arquivo se não houver EXIF/nome" : "Ignorar arquivos sem data no EXIF ou no nome"}
        </span>
      </div>

      <div className="rounded-xl border border-dashed border-teal-500/30 bg-teal-500/5 p-4 space-y-2">
        <p className="text-sm text-teal-300/80">💡 <strong>Estrutura criada automaticamente:</strong></p>
        <p className="text-xs text-muted-foreground font-mono">
          Fotos/<span className="text-teal-400">2024</span>/<span className="text-teal-400">03 - Março</span>/foto.jpg
        </p>
        <p className="text-xs text-muted-foreground font-mono">
          Vídeos/<span className="text-teal-400">2024</span>/<span className="text-teal-400">03 - Março</span>/video.mp4
        </p>
        <p className="text-xs text-muted-foreground mt-1">Prioridade de data: EXIF → nome do arquivo → data de modificação</p>
      </div>

      <ProgressBar progress={progress} accentColor="bg-teal-500" />

      <div className="flex gap-3">
        <button
          onClick={handleOrganizar}
          disabled={loading || !!taskId}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-6 py-3
                     text-sm font-semibold text-white hover:bg-teal-700 active:bg-teal-800
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <Play className="h-4 w-4" />
          ORGANIZAR POR DATA
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
