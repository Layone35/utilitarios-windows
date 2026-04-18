import { useState } from "react";
import { cn } from "../lib/utils";
import { FolderInput } from "./ui/FolderInput";
import { RadioGroup } from "./ui/RadioGroup";
import { ProgressBar } from "./ui/ProgressBar";
import {
  apiCompressVideo,
  apiCompressAudio,
  apiCompressImage,
  apiCompressPdf,
  apiCancelCompress,
} from "../lib/api";
import type { WsProgressMessage } from "../hooks/useWebSocket";
import { Play, Square } from "lucide-react";

interface ExtrasTabProps {
  progressMap: Record<string, WsProgressMessage>;
  onLog: (msg: string, nivel: string) => void;
}

type SubTab = "video" | "audio" | "imagem" | "pdf";

export function ExtrasTab({ progressMap, onLog }: ExtrasTabProps) {
  const [subTab, setSubTab] = useState<SubTab>("video");
  const [taskId, setTaskId] = useState<string | null>(null);
  const progress = taskId ? (progressMap[taskId] ?? null) : null;
  const [loading, setLoading] = useState(false);

  // ── Vídeo ──────────────────────────────────────────────────
  const [cvOrigem, setCvOrigem] = useState("");
  const [cvDestino, setCvDestino] = useState("");
  const [cvCrf, setCvCrf] = useState(28);
  const [cvRes, setCvRes] = useState("original");
  const [cvCodec, setCvCodec] = useState("h264");
  const [cvPreset, setCvPreset] = useState("veryfast");
  const [cvGpu, setCvGpu] = useState("cpu");

  // ── Áudio ──────────────────────────────────────────────────
  const [caOrigem, setCaOrigem] = useState("");
  const [caDestino, setCaDestino] = useState("");
  const [caBr, setCaBr] = useState("128k");

  // ── Imagem ─────────────────────────────────────────────────
  const [ciOrigem, setCiOrigem] = useState("");
  const [ciDestino, setCiDestino] = useState("");
  const [ciQual, setCiQual] = useState(75);
  const [ciEscala, setCiEscala] = useState("original");
  const [ciFmt, setCiFmt] = useState("original");

  // ── PDF ────────────────────────────────────────────────────
  const [cpOrigem, setCpOrigem] = useState("");
  const [cpDestino, setCpDestino] = useState("");
  const [cpQual, setCpQual] = useState("ebook");

  // ── Opções globais ─────────────────────────────────────────
  const [incluirSubpastas, setIncluirSubpastas] = useState(true);
  const [pularExistentes, setPularExistentes] = useState(false);

  const handleCompress = async () => {
    try {
      setLoading(true);
      let res;
      switch (subTab) {
        case "video":
          res = await apiCompressVideo({
            pasta_origem: cvOrigem,
            pasta_destino: cvDestino,
            crf: cvCrf,
            resolucao: cvRes,
            codec: cvCodec,
            preset: cvPreset,
            gpu: cvGpu,
            incluir_subpastas: incluirSubpastas,
            pular_existentes: pularExistentes,
          });
          break;
        case "audio":
          res = await apiCompressAudio({
            pasta_origem: caOrigem,
            pasta_destino: caDestino,
            bitrate: caBr,
            incluir_subpastas: incluirSubpastas,
            pular_existentes: pularExistentes,
          });
          break;
        case "imagem":
          res = await apiCompressImage({
            pasta_origem: ciOrigem,
            pasta_destino: ciDestino,
            qualidade: ciQual,
            escala: ciEscala,
            formato: ciFmt,
            incluir_subpastas: incluirSubpastas,
            pular_existentes: pularExistentes,
          });
          break;
        case "pdf":
          res = await apiCompressPdf({
            pasta_origem: cpOrigem,
            pasta_destino: cpDestino,
            qualidade: cpQual,
            incluir_subpastas: incluirSubpastas,
            pular_existentes: pularExistentes,
          });
          break;
      }
      if (res) {
        setTaskId(res.task_id);
        onLog(`▶ ${res.message}`, "info");
      }
    } catch (err) {
      onLog(`❌ Erro: ${err}`, "erro");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (taskId) {
      await apiCancelCompress(taskId);
      onLog("⏹ Cancelamento solicitado.", "warn");
      setTaskId(null);
    }
  };

  const subTabs = [
    { id: "video" as SubTab, label: "🎬 Vídeo" },
    { id: "audio" as SubTab, label: "🎵 Áudio" },
    { id: "imagem" as SubTab, label: "🖼️ Imagem" },
    { id: "pdf" as SubTab, label: "📄 PDF" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">🗜️ Comprimir Arquivos</h3>
        <p className="text-sm text-muted-foreground">
          Reduz o tamanho de vídeos, áudios, imagens e PDFs. O original nunca é
          alterado.
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all",
              subTab === tab.id
                ? "bg-card text-amber-400 shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Compressão de Vídeo */}
      {subTab === "video" && (
        <div className="space-y-4">
          <FolderInput
            label="Pasta de origem (vídeos)"
            value={cvOrigem}
            onChange={setCvOrigem}
            icon="📂"
            accentColor="text-amber-400"
          />
          <FolderInput
            label="Pasta de destino"
            value={cvDestino}
            onChange={setCvDestino}
            icon="📥"
            accentColor="text-emerald-400"
          />
          <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-4">
              <RadioGroup
                label="Qualidade (CRF)"
                value={String(cvCrf)}
                onChange={(v) => setCvCrf(Number(v))}
                options={[
                  { label: "Leve (CRF 24)", value: "24" },
                  { label: "Médio (CRF 28)", value: "28" },
                  { label: "Máximo (CRF 33)", value: "33" },
                ]}
              />
              <RadioGroup
                label="Resolução"
                value={cvRes}
                onChange={setCvRes}
                options={[
                  { label: "Original", value: "original" },
                  { label: "1080p", value: "1080" },
                  { label: "720p", value: "720" },
                  { label: "480p", value: "480" },
                ]}
              />
            </div>
            <div className="space-y-4">
              <RadioGroup
                label="Codec"
                value={cvCodec}
                onChange={setCvCodec}
                options={[
                  { label: "H.264 (compatível)", value: "h264" },
                  { label: "H.265 (40% menor ⚡)", value: "h265" },
                ]}
              />
              <RadioGroup
                label="Velocidade"
                value={cvPreset}
                onChange={setCvPreset}
                options={[
                  { label: "Ultrafast", value: "ultrafast" },
                  { label: "Veryfast ⚡", value: "veryfast" },
                  { label: "Fast", value: "fast" },
                  { label: "Medium", value: "medium" },
                ]}
              />
            </div>
            <RadioGroup
              label="🖥️ Aceleração GPU"
              value={cvGpu}
              onChange={setCvGpu}
              options={[
                { label: "CPU (sempre funciona)", value: "cpu" },
                { label: "NVIDIA — NVENC ⚡", value: "nvenc" },
                { label: "AMD — AMF ⚡", value: "amf" },
                { label: "Intel — Quick Sync ⚡", value: "qsv" },
              ]}
            />
          </div>
        </div>
      )}

      {/* Compressão de Áudio */}
      {subTab === "audio" && (
        <div className="space-y-4">
          <FolderInput
            label="Pasta de origem (áudios)"
            value={caOrigem}
            onChange={setCaOrigem}
            icon="📂"
            accentColor="text-amber-400"
          />
          <FolderInput
            label="Pasta de destino"
            value={caDestino}
            onChange={setCaDestino}
            icon="📥"
            accentColor="text-emerald-400"
          />
          <div className="border-t pt-4">
            <RadioGroup
              label="Qualidade (bitrate de saída)"
              value={caBr}
              onChange={setCaBr}
              options={[
                { label: "Alta — 192 kbps (músicas)", value: "192k" },
                { label: "Média — 128 kbps (podcasts)", value: "128k" },
                { label: "Baixa — 96 kbps (redução geral)", value: "96k" },
                { label: "Voz — 64 kbps (menor tamanho)", value: "64k" },
              ]}
            />
            <p className="text-xs text-muted-foreground mt-3">
              Saída sempre em MP3. Aceita: .mp3 .wav .ogg .m4a .flac .aac .wma
            </p>
          </div>
        </div>
      )}

      {/* Compressão de Imagem */}
      {subTab === "imagem" && (
        <div className="space-y-4">
          <FolderInput
            label="Pasta de origem (imagens)"
            value={ciOrigem}
            onChange={setCiOrigem}
            icon="📂"
            accentColor="text-amber-400"
          />
          <FolderInput
            label="Pasta de destino"
            value={ciDestino}
            onChange={setCiDestino}
            icon="📥"
            accentColor="text-emerald-400"
          />
          <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">
                Qualidade JPEG/WebP: {ciQual}
              </label>
              <input
                type="range"
                min={10}
                max={95}
                value={ciQual}
                onChange={(e) => setCiQual(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground/50">
                <span>Menor arquivo</span>
                <span>Alta qualidade</span>
              </div>
            </div>
            <RadioGroup
              label="Redimensionar"
              value={ciEscala}
              onChange={setCiEscala}
              options={[
                { label: "Original", value: "original" },
                { label: "75%", value: "75" },
                { label: "50%", value: "50" },
                { label: "25%", value: "25" },
              ]}
            />
            <RadioGroup
              label="Formato de saída"
              value={ciFmt}
              onChange={setCiFmt}
              options={[
                { label: "Original (mantém)", value: "original" },
                { label: "JPEG (universal)", value: "jpeg" },
                { label: "WebP (melhor compressão ⚡)", value: "webp" },
                { label: "PNG (sem perda)", value: "png" },
              ]}
            />
          </div>
        </div>
      )}

      {/* Compressão de PDF */}
      {subTab === "pdf" && (
        <div className="space-y-4">
          <FolderInput
            label="Pasta de origem (PDFs)"
            value={cpOrigem}
            onChange={setCpOrigem}
            icon="📂"
            accentColor="text-amber-400"
          />
          <FolderInput
            label="Pasta de destino"
            value={cpDestino}
            onChange={setCpDestino}
            icon="📥"
            accentColor="text-emerald-400"
          />
          <div className="border-t pt-4">
            <RadioGroup
              label="Qualidade de saída"
              value={cpQual}
              onChange={setCpQual}
              options={[
                {
                  label: "Screen — menor tamanho (72 dpi)",
                  value: "screen",
                  desc: "ideal para tela",
                },
                {
                  label: "Ebook — equilíbrio (150 dpi)",
                  value: "ebook",
                  desc: "tablets/e-readers",
                },
                {
                  label: "Printer — alta qualidade (300 dpi)",
                  value: "printer",
                  desc: "impressão",
                },
              ]}
            />
            <p className="text-xs text-muted-foreground mt-3">
              Requer Ghostscript instalado no sistema (gswin64c no PATH).
            </p>
          </div>
        </div>
      )}

      {/* Toggles globais */}
      <div className="space-y-2">
        <label className="flex items-center gap-3 cursor-pointer group">
          <button
            type="button"
            onClick={() => setIncluirSubpastas((v) => !v)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
              incluirSubpastas ? "bg-amber-500" : "bg-secondary",
            )}
          >
            <span className={cn(
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200",
              incluirSubpastas ? "translate-x-5" : "translate-x-0",
            )} />
          </button>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            {incluirSubpastas ? "Incluindo arquivos em subpastas" : "Apenas pasta principal (sem subpastas)"}
          </span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer group">
          <button
            type="button"
            onClick={() => setPularExistentes((v) => !v)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
              pularExistentes ? "bg-amber-500" : "bg-secondary",
            )}
          >
            <span className={cn(
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200",
              pularExistentes ? "translate-x-5" : "translate-x-0",
            )} />
          </button>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            {pularExistentes
              ? "Pulando arquivos já existentes no destino (retomável)"
              : "Reprocessar mesmo se já existir no destino"}
          </span>
        </label>
      </div>

      {/* Progresso */}
      <ProgressBar progress={progress} accentColor="bg-amber-500" />

      {/* Botões */}
      <div className="flex gap-3">
        <button
          onClick={handleCompress}
          disabled={loading || !!taskId}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-6 py-3
                     text-sm font-semibold text-white hover:bg-amber-700 active:bg-amber-800
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <Play className="h-4 w-4" />
          COMPRIMIR
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
