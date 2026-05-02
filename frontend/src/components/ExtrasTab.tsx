import { useState } from "react";
import { cn } from "../lib/utils";
import { ProgressBar } from "./ui/ProgressBar";
import {
  apiCompressVideo,
  apiCompressAudio,
  apiCompressImage,
  apiCompressPdf,
  apiCancelCompress,
} from "../lib/api";
import type { WsProgressMessage } from "../hooks/useWebSocket";
import { Square } from "lucide-react";
import { CompressVideoPanel } from "./compress/CompressVideoPanel";
import { CompressAudioPanel } from "./compress/CompressAudioPanel";
import { CompressImagemPanel } from "./compress/CompressImagemPanel";
import { CompressPdfPanel } from "./compress/CompressPdfPanel";

interface ExtrasTabProps {
  progressMap: Record<string, WsProgressMessage>;
  onLog: (msg: string, nivel: string) => void;
}

type SubTab = "video" | "audio" | "imagem" | "pdf";

export function ExtrasTab({ progressMap, onLog }: ExtrasTabProps) {
  const [subTab, setSubTab] = useState<SubTab>("video");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [incluirSubpastas, setIncluirSubpastas] = useState(true);
  const [pularExistentes, setPularExistentes] = useState(false);

  const progress = taskId ? (progressMap[taskId] ?? null) : null;

  const handleCompress = async (payload: Record<string, unknown>) => {
    try {
      setLoading(true);
      let res;
      const shared = { incluir_subpastas: incluirSubpastas, pular_existentes: pularExistentes };
      switch (subTab) {
        case "video":  res = await apiCompressVideo({ ...payload, ...shared } as Parameters<typeof apiCompressVideo>[0]); break;
        case "audio":  res = await apiCompressAudio({ ...payload, ...shared } as Parameters<typeof apiCompressAudio>[0]); break;
        case "imagem": res = await apiCompressImage({ ...payload, ...shared } as Parameters<typeof apiCompressImage>[0]); break;
        case "pdf":    res = await apiCompressPdf({ ...payload, ...shared } as Parameters<typeof apiCompressPdf>[0]); break;
      }
      if (res) { setTaskId(res.task_id); onLog(`▶ ${res.message}`, "info"); }
    } catch (err) {
      onLog(`❌ Erro: ${err}`, "erro");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (taskId) { await apiCancelCompress(taskId); onLog("⏹ Cancelamento solicitado.", "warn"); setTaskId(null); }
  };

  const subTabs: { id: SubTab; label: string }[] = [
    { id: "video",  label: "🎬 Vídeo" },
    { id: "audio",  label: "🎵 Áudio" },
    { id: "imagem", label: "🖼️ Imagem" },
    { id: "pdf",    label: "📄 PDF" },
  ];

  const disabled = loading || !!taskId;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">🗜️ Comprimir Arquivos</h3>
        <p className="text-sm text-muted-foreground">Reduz o tamanho de vídeos, áudios, imagens e PDFs. O original nunca é alterado.</p>
      </div>

      <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all",
              subTab === tab.id ? "bg-card text-amber-400 shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {subTab === "video"  && <CompressVideoPanel  disabled={disabled} onCompress={handleCompress} />}
      {subTab === "audio"  && <CompressAudioPanel  disabled={disabled} onCompress={handleCompress} />}
      {subTab === "imagem" && <CompressImagemPanel disabled={disabled} onCompress={handleCompress} />}
      {subTab === "pdf"    && <CompressPdfPanel    disabled={disabled} onCompress={handleCompress} />}

      <div className="space-y-2">
        <label className="flex items-center gap-3 cursor-pointer group">
          <button
            type="button"
            onClick={() => setIncluirSubpastas((v) => !v)}
            className={cn("relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200", incluirSubpastas ? "bg-amber-500" : "bg-secondary")}
          >
            <span className={cn("pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200", incluirSubpastas ? "translate-x-5" : "translate-x-0")} />
          </button>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            {incluirSubpastas ? "Incluindo arquivos em subpastas" : "Apenas pasta principal (sem subpastas)"}
          </span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer group">
          <button
            type="button"
            onClick={() => setPularExistentes((v) => !v)}
            className={cn("relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200", pularExistentes ? "bg-amber-500" : "bg-secondary")}
          >
            <span className={cn("pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200", pularExistentes ? "translate-x-5" : "translate-x-0")} />
          </button>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            {pularExistentes ? "Pulando arquivos já existentes no destino (retomável)" : "Reprocessar mesmo se já existir no destino"}
          </span>
        </label>
      </div>

      <ProgressBar progress={progress} accentColor="bg-amber-500" />

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
  );
}
