import { useState } from "react";
import { FolderInput } from "../ui/FolderInput";
import { RadioGroup } from "../ui/RadioGroup";

interface Payload {
  pasta_origem: string;
  pasta_destino: string;
  qualidade: number;
  escala: string;
  formato: string;
}

interface Props {
  disabled: boolean;
  onCompress: (payload: Payload) => void;
}

export function CompressImagemPanel({ disabled, onCompress }: Props) {
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [qualidade, setQualidade] = useState(75);
  const [escala, setEscala] = useState("original");
  const [formato, setFormato] = useState("original");

  return (
    <div className="space-y-4">
      <FolderInput label="Pasta de origem (imagens)" value={origem} onChange={setOrigem} icon="📂" accentColor="text-amber-400" />
      <FolderInput label="Pasta de destino" value={destino} onChange={setDestino} icon="📥" accentColor="text-emerald-400" />
      <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Qualidade JPEG/WebP: {qualidade}</label>
          <input
            type="range"
            min={10}
            max={95}
            value={qualidade}
            onChange={(e) => setQualidade(Number(e.target.value))}
            className="w-full accent-amber-500"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground/50">
            <span>Menor arquivo</span>
            <span>Alta qualidade</span>
          </div>
        </div>
        <RadioGroup
          label="Redimensionar"
          value={escala}
          onChange={setEscala}
          options={[
            { label: "Original", value: "original" },
            { label: "75%", value: "75" },
            { label: "50%", value: "50" },
            { label: "25%", value: "25" },
          ]}
        />
        <RadioGroup
          label="Formato de saída"
          value={formato}
          onChange={setFormato}
          options={[
            { label: "Original (mantém)", value: "original" },
            { label: "JPEG (universal)", value: "jpeg" },
            { label: "WebP (melhor compressão ⚡)", value: "webp" },
            { label: "PNG (sem perda)", value: "png" },
          ]}
        />
      </div>
      <button
        onClick={() => onCompress({ pasta_origem: origem, pasta_destino: destino, qualidade, escala, formato })}
        disabled={disabled || !origem || !destino}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-6 py-3
                   text-sm font-semibold text-white hover:bg-amber-700 active:bg-amber-800
                   disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
      >
        COMPRIMIR IMAGENS
      </button>
    </div>
  );
}
