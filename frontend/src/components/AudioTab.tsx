import { useState } from "react";
import { cn } from "../lib/utils";
import { FolderInput } from "./ui/FolderInput";
import { RadioGroup } from "./ui/RadioGroup";
import { ProgressBar } from "./ui/ProgressBar";
import { apiExtractAudio, apiConvertAudio, apiCancelAudio } from "../lib/api";
import type { WsProgressMessage } from "../hooks/useWebSocket";
import { Play, Square } from "lucide-react";

interface AudioTabProps {
  progress: WsProgressMessage | null;
  onLog: (msg: string, nivel: string) => void;
}

type SubTab = "extract" | "convert";

export function AudioTab({ progress, onLog }: AudioTabProps) {
  const [subTab, setSubTab] = useState<SubTab>("extract");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Vídeo → Áudio ──────────────────────────────────────────
  const [vaOrigem, setVaOrigem] = useState("");
  const [vaDestino, setVaDestino] = useState("");
  const [vaFormato, setVaFormato] = useState("mp3");
  const [vaBitrate, setVaBitrate] = useState("192");
  const [vaManter, setVaManter] = useState("true");
  const [vaSubpastas, setVaSubpastas] = useState(true);

  // ── Áudio → Áudio ──────────────────────────────────────────
  const [aaOrigem, setAaOrigem] = useState("");
  const [aaDestino, setAaDestino] = useState("");
  const [aaFormato, setAaFormato] = useState("mp3");
  const [aaBitrate, setAaBitrate] = useState("192");
  const [aaSubpastas, setAaSubpastas] = useState(true);

  const handleStart = async () => {
    try {
      setLoading(true);
      if (subTab === "extract") {
        const res = await apiExtractAudio({
          pasta_origem: vaOrigem,
          pasta_destino: vaDestino,
          formato: vaFormato,
          bitrate: vaBitrate,
          manter_nome: vaManter === "true",
          incluir_subpastas: vaSubpastas,
        });
        setTaskId(res.task_id);
        onLog(`▶ ${res.message}`, "info");
      } else {
        const res = await apiConvertAudio({
          pasta_origem: aaOrigem,
          pasta_destino: aaDestino,
          formato: aaFormato,
          bitrate: aaBitrate,
          incluir_subpastas: aaSubpastas,
        });
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
      await apiCancelAudio(taskId);
      onLog("⏹ Cancelamento solicitado.", "warn");
      setTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
        {[
          { id: "extract" as SubTab, label: "🎬→🎵 Vídeo → Áudio" },
          { id: "convert" as SubTab, label: "🎵→🎵 Áudio → Áudio" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all",
              subTab === tab.id
                ? "bg-card text-pink-400 shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Vídeo → Áudio */}
      {subTab === "extract" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Extrai a trilha de áudio de qualquer vídeo (MP4, MKV, AVI, TS…).
          </p>
          <FolderInput
            label="Pasta com Vídeos"
            value={vaOrigem}
            onChange={setVaOrigem}
            icon="🎬"
            accentColor="text-pink-400"
          />
          <FolderInput
            label="Pasta Destino"
            value={vaDestino}
            onChange={setVaDestino}
            icon="📥"
            accentColor="text-emerald-400"
          />
          <label className="flex items-center gap-3 cursor-pointer group">
            <button
              type="button"
              onClick={() => setVaSubpastas((v) => !v)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
                vaSubpastas ? "bg-pink-500" : "bg-secondary",
              )}
            >
              <span className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200",
                vaSubpastas ? "translate-x-5" : "translate-x-0",
              )} />
            </button>
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              {vaSubpastas ? "Incluindo arquivos em subpastas" : "Apenas pasta principal (sem subpastas)"}
            </span>
          </label>

          <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
            <RadioGroup
              label="Formato de saída"
              value={vaFormato}
              onChange={setVaFormato}
              options={[
                { label: "MP3 — mais compatível", value: "mp3" },
                { label: "AAC — eficiente", value: "aac" },
                { label: "WAV — sem compressão", value: "wav" },
                { label: "FLAC — lossless", value: "flac" },
                { label: "OGG — open source", value: "ogg" },
                { label: "M4A — padrão Apple", value: "m4a" },
              ]}
            />
            <RadioGroup
              label="Bitrate"
              value={vaBitrate}
              onChange={setVaBitrate}
              options={[
                { label: "96 kbps", value: "96" },
                { label: "128 kbps", value: "128" },
                { label: "192 kbps", value: "192" },
                { label: "256 kbps", value: "256" },
                { label: "320 kbps", value: "320" },
              ]}
            />
            <RadioGroup
              label="Nome dos arquivos"
              value={vaManter}
              onChange={setVaManter}
              options={[
                { label: "Manter nome original", value: "true" },
                { label: "Sequencial (audio_001)", value: "false" },
              ]}
            />
          </div>
        </div>
      )}

      {/* Áudio → Áudio */}
      {subTab === "convert" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Converte áudios entre formatos (MP3, WAV, FLAC, OGG, AAC, M4A,
            OPUS…).
          </p>
          <FolderInput
            label="Pasta com Áudios"
            value={aaOrigem}
            onChange={setAaOrigem}
            icon="🎵"
            accentColor="text-pink-400"
          />
          <FolderInput
            label="Pasta Destino"
            value={aaDestino}
            onChange={setAaDestino}
            icon="📥"
            accentColor="text-emerald-400"
          />
          <label className="flex items-center gap-3 cursor-pointer group">
            <button
              type="button"
              onClick={() => setAaSubpastas((v) => !v)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
                aaSubpastas ? "bg-pink-500" : "bg-secondary",
              )}
            >
              <span className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200",
                aaSubpastas ? "translate-x-5" : "translate-x-0",
              )} />
            </button>
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
              {aaSubpastas ? "Incluindo arquivos em subpastas" : "Apenas pasta principal (sem subpastas)"}
            </span>
          </label>

          <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <RadioGroup
              label="Formato de saída"
              value={aaFormato}
              onChange={setAaFormato}
              options={[
                { label: "MP3", value: "mp3" },
                { label: "AAC", value: "aac" },
                { label: "WAV", value: "wav" },
                { label: "FLAC", value: "flac" },
                { label: "OGG", value: "ogg" },
                { label: "M4A", value: "m4a" },
                { label: "OPUS", value: "opus" },
              ]}
            />
            <RadioGroup
              label="Bitrate (formatos lossy)"
              value={aaBitrate}
              onChange={setAaBitrate}
              options={[
                { label: "96 kbps", value: "96" },
                { label: "128 kbps", value: "128" },
                { label: "192 kbps", value: "192" },
                { label: "256 kbps", value: "256" },
                { label: "320 kbps", value: "320" },
              ]}
            />
          </div>
        </div>
      )}

      {/* Progresso */}
      <ProgressBar progress={progress} accentColor="bg-pink-500" />

      {/* Botões */}
      <div className="flex gap-3">
        <button
          onClick={handleStart}
          disabled={loading || !!taskId}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-pink-600 px-6 py-3
                     text-sm font-semibold text-white hover:bg-pink-700 active:bg-pink-800
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <Play className="h-4 w-4" />
          {subTab === "extract" ? "EXTRAIR ÁUDIO" : "CONVERTER ÁUDIOS"}
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
