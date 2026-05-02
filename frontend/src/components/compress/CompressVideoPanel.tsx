import { useState } from "react";
import { FolderInput } from "../ui/FolderInput";
import { RadioGroup } from "../ui/RadioGroup";

interface Payload {
  pasta_origem: string;
  pasta_destino: string;
  crf: number;
  resolucao: string;
  codec: string;
  preset: string;
  gpu: string;
}

interface Props {
  disabled: boolean;
  onCompress: (payload: Payload) => void;
}

export function CompressVideoPanel({ disabled, onCompress }: Props) {
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [crf, setCrf] = useState(28);
  const [resolucao, setResolucao] = useState("original");
  const [codec, setCodec] = useState("h264");
  const [preset, setPreset] = useState("veryfast");
  const [gpu, setGpu] = useState("cpu");

  return (
    <div className="space-y-4">
      <FolderInput label="Pasta de origem (vídeos)" value={origem} onChange={setOrigem} icon="📂" accentColor="text-amber-400" />
      <FolderInput label="Pasta de destino" value={destino} onChange={setDestino} icon="📥" accentColor="text-emerald-400" />
      <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <RadioGroup
            label="Qualidade (CRF)"
            value={String(crf)}
            onChange={(v) => setCrf(Number(v))}
            options={[
              { label: "Leve (CRF 24)", value: "24" },
              { label: "Médio (CRF 28)", value: "28" },
              { label: "Máximo (CRF 33)", value: "33" },
            ]}
          />
          <RadioGroup
            label="Resolução"
            value={resolucao}
            onChange={setResolucao}
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
            value={codec}
            onChange={setCodec}
            options={[
              { label: "H.264 (compatível)", value: "h264" },
              { label: "H.265 (40% menor ⚡)", value: "h265" },
            ]}
          />
          <RadioGroup
            label="Velocidade"
            value={preset}
            onChange={setPreset}
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
          value={gpu}
          onChange={setGpu}
          options={[
            { label: "CPU (sempre funciona)", value: "cpu" },
            { label: "NVIDIA — NVENC ⚡", value: "nvenc" },
            { label: "AMD — AMF ⚡", value: "amf" },
            { label: "Intel — Quick Sync ⚡", value: "qsv" },
          ]}
        />
      </div>
      <button
        onClick={() => onCompress({ pasta_origem: origem, pasta_destino: destino, crf, resolucao, codec, preset, gpu })}
        disabled={disabled || !origem || !destino}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-6 py-3
                   text-sm font-semibold text-white hover:bg-amber-700 active:bg-amber-800
                   disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
      >
        COMPRIMIR VÍDEOS
      </button>
    </div>
  );
}
