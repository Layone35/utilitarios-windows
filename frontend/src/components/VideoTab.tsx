import { useState } from "react";
import { cn } from "../lib/utils";
import { FolderInput } from "./ui/FolderInput";
import { RadioGroup } from "./ui/RadioGroup";
import { ProgressBar } from "./ui/ProgressBar";
import { apiConvertVideo, apiCancelVideo } from "../lib/api";
import type { WsProgressMessage } from "../hooks/useWebSocket";
import { Play, Square } from "lucide-react";

interface VideoTabProps {
  progress: WsProgressMessage | null;
  onLog: (msg: string, nivel: string) => void;
}

type SubTab = "ts" | "video";

export function VideoTab({ progress, onLog }: VideoTabProps) {
  const [subTab, setSubTab] = useState<SubTab>("ts");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── TS → MP4 ────────────────────────────────────────────────
  const [tsOrigem, setTsOrigem] = useState("");
  const [tsDestino, setTsDestino] = useState("");
  const [tsModo, setTsModo] = useState<"copy" | "encode">("copy");
  const [tsSubpastas, setTsSubpastas] = useState(true);

  // ── Vídeo → Vídeo ──────────────────────────────────────────
  const [vvOrigem, setVvOrigem] = useState("");
  const [vvDestino, setVvDestino] = useState("");
  const [vvFormato, setVvFormato] = useState("mp4");
  const [vvCodec, setVvCodec] = useState("copy");
  const [vvCrf, setVvCrf] = useState(23);
  const [vvPreset, setVvPreset] = useState("fast");
  const [vvSubpastas, setVvSubpastas] = useState(true);

  const handleConvert = async () => {
    try {
      setLoading(true);
      const body =
        subTab === "ts"
          ? {
              pasta_origem: tsOrigem,
              pasta_destino: tsDestino,
              modo_ts: true,
              codec: tsModo === "copy" ? "copy" : "h264",
              crf: 23,
              preset: "fast",
              formato: "mp4",
              incluir_subpastas: tsSubpastas,
            }
          : {
              pasta_origem: vvOrigem,
              pasta_destino: vvDestino,
              modo_ts: false,
              formato: vvFormato,
              codec: vvCodec,
              crf: vvCrf,
              preset: vvPreset,
              incluir_subpastas: vvSubpastas,
            };

      const res = await apiConvertVideo(body);
      setTaskId(res.task_id);
      onLog(`▶ ${res.message} (ID: ${res.task_id})`, "info");
    } catch (err) {
      onLog(`❌ Erro: ${err}`, "erro");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (taskId) {
      await apiCancelVideo(taskId);
      onLog("⏹ Cancelamento solicitado.", "warn");
      setTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
        {[
          { id: "ts" as SubTab, label: "🔄 TS → MP4" },
          { id: "video" as SubTab, label: "📹 Vídeo → Vídeo" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all",
              subTab === tab.id
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TS → MP4 */}
      {subTab === "ts" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Converte arquivos .ts para .mp4. Original nunca é alterado.
          </p>
          <FolderInput
            label="Pasta de origem (.ts)"
            value={tsOrigem}
            onChange={setTsOrigem}
            icon="📂"
            accentColor="text-cyan-400"
          />
          <FolderInput
            label="Pasta de destino (.mp4)"
            value={tsDestino}
            onChange={setTsDestino}
            icon="📥"
            accentColor="text-emerald-400"
          />
          <label className="flex items-center gap-3 cursor-pointer group">
            <button
              type="button"
              onClick={() => setTsSubpastas((v) => !v)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
                tsSubpastas ? "bg-cyan-500" : "bg-secondary",
              )}
            >
              <span className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200",
                tsSubpastas ? "translate-x-5" : "translate-x-0",
              )} />
            </button>
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              {tsSubpastas ? "Incluindo arquivos em subpastas" : "Apenas pasta principal (sem subpastas)"}
            </span>
          </label>

          <div className="border-t pt-4">
            <RadioGroup
              label="Modo de conversão"
              value={tsModo}
              onChange={setTsModo}
              options={[
                {
                  label: "⚡ Remux (cópia direta)",
                  value: "copy",
                  desc: "Ultra-rápido, sem perda",
                },
                {
                  label: "🔄 Re-encodar (H.264)",
                  value: "encode",
                  desc: "Mais lento, recomprime",
                },
              ]}
            />
          </div>
        </div>
      )}

      {/* Vídeo → Vídeo */}
      {subTab === "video" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Converte qualquer vídeo (MP4, MKV, AVI, TS…) para outro formato.
          </p>
          <FolderInput
            label="Pasta de origem"
            value={vvOrigem}
            onChange={setVvOrigem}
            icon="📂"
            accentColor="text-cyan-400"
          />
          <FolderInput
            label="Pasta de destino"
            value={vvDestino}
            onChange={setVvDestino}
            icon="📥"
            accentColor="text-emerald-400"
          />
          <label className="flex items-center gap-3 cursor-pointer group">
            <button
              type="button"
              onClick={() => setVvSubpastas((v) => !v)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
                vvSubpastas ? "bg-cyan-500" : "bg-secondary",
              )}
            >
              <span className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200",
                vvSubpastas ? "translate-x-5" : "translate-x-0",
              )} />
            </button>
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              {vvSubpastas ? "Incluindo arquivos em subpastas" : "Apenas pasta principal (sem subpastas)"}
            </span>
          </label>

          <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
            <RadioGroup
              label="Formato de saída"
              value={vvFormato}
              onChange={setVvFormato}
              options={[
                { label: "MP4", value: "mp4" },
                { label: "MKV", value: "mkv" },
                { label: "AVI", value: "avi" },
                { label: "MOV", value: "mov" },
                { label: "WebM", value: "webm" },
              ]}
            />
            <RadioGroup
              label="Codec de vídeo"
              value={vvCodec}
              onChange={setVvCodec}
              options={[
                { label: "⚡ Remux — sem recodificar", value: "copy", desc: "instante, sem perda" },
                { label: "🟢 H.264 — recomendado ★", value: "h264", desc: "rápido, compatível com tudo" },
                { label: "🔵 H.265 — menor arquivo", value: "h265", desc: "~40% menor, demora ~2x mais" },
              ]}
            />
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Qualidade (CRF): {vvCrf}
                  {vvCrf <= 18 && <span className="ml-2 text-emerald-400 text-xs">✨ quase sem perda</span>}
                  {vvCrf >= 19 && vvCrf <= 25 && <span className="ml-2 text-cyan-400 text-xs">★ ótimo equilíbrio</span>}
                  {vvCrf >= 26 && vvCrf <= 32 && <span className="ml-2 text-yellow-400 text-xs">📦 foco em tamanho</span>}
                  {vvCrf >= 33 && <span className="ml-2 text-red-400 text-xs">⚠️ qualidade baixa</span>}
                </label>
                <input
                  type="range"
                  min={0}
                  max={51}
                  value={vvCrf}
                  onChange={(e) => setVvCrf(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground/50">
                  <span>0 — máx qualidade</span>
                  <span>51 — mínimo arquivo</span>
                </div>
              </div>
              <RadioGroup
                label="Velocidade de codificação"
                value={vvPreset}
                onChange={setVvPreset}
                options={[
                  { label: "⚡ ultrafast", value: "ultrafast", desc: "arquivo maior" },
                  { label: "🚀 veryfast", value: "veryfast", desc: "bom custo-benefício" },
                  { label: "🟢 fast — recomendado ★", value: "fast", desc: "velocidade + compressão" },
                  { label: "🐢 medium", value: "medium", desc: "melhor compressão, lento" },
                ]}
              />
            </div>
          </div>
        </div>
      )}

      {/* Progresso */}
      <ProgressBar progress={progress} accentColor="bg-cyan-500" />

      {/* Botões */}
      <div className="flex gap-3">
        <button
          onClick={handleConvert}
          disabled={loading || !!taskId}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-6 py-3
                     text-sm font-semibold text-white hover:bg-cyan-700 active:bg-cyan-800
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <Play className="h-4 w-4" />
          {subTab === "ts" ? "CONVERTER TS → MP4" : "CONVERTER VÍDEOS"}
        </button>
        {taskId && (
          <button
            onClick={handleCancel}
            className="flex items-center gap-2 rounded-lg bg-red-600/20 px-6 py-3 text-sm
                       font-semibold text-red-400 hover:bg-red-600/30 transition-all"
          >
            <Square className="h-4 w-4" />
            PARAR
          </button>
        )}
      </div>
    </div>
  );
}
