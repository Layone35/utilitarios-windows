import { useState } from "react";
import { FolderInput } from "../ui/FolderInput";
import { RadioGroup } from "../ui/RadioGroup";

interface Payload {
  pasta_origem: string;
  pasta_destino: string;
  bitrate: string;
}

interface Props {
  disabled: boolean;
  onCompress: (payload: Payload) => void;
}

export function CompressAudioPanel({ disabled, onCompress }: Props) {
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [bitrate, setBitrate] = useState("128k");

  return (
    <div className="space-y-4">
      <FolderInput label="Pasta de origem (áudios)" value={origem} onChange={setOrigem} icon="📂" accentColor="text-amber-400" />
      <FolderInput label="Pasta de destino" value={destino} onChange={setDestino} icon="📥" accentColor="text-emerald-400" />
      <div className="border-t pt-4">
        <RadioGroup
          label="Qualidade (bitrate de saída)"
          value={bitrate}
          onChange={setBitrate}
          options={[
            { label: "Alta — 192 kbps (músicas)", value: "192k" },
            { label: "Média — 128 kbps (podcasts)", value: "128k" },
            { label: "Baixa — 96 kbps (redução geral)", value: "96k" },
            { label: "Voz — 64 kbps (menor tamanho)", value: "64k" },
          ]}
        />
        <p className="text-xs text-muted-foreground mt-3">Saída sempre em MP3. Aceita: .mp3 .wav .ogg .m4a .flac .aac .wma</p>
      </div>
      <button
        onClick={() => onCompress({ pasta_origem: origem, pasta_destino: destino, bitrate })}
        disabled={disabled || !origem || !destino}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-6 py-3
                   text-sm font-semibold text-white hover:bg-amber-700 active:bg-amber-800
                   disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
      >
        COMPRIMIR ÁUDIOS
      </button>
    </div>
  );
}
