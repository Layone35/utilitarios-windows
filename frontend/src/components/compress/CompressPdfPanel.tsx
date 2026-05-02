import { useState } from "react";
import { FolderInput } from "../ui/FolderInput";
import { RadioGroup } from "../ui/RadioGroup";

interface Payload {
  pasta_origem: string;
  pasta_destino: string;
  qualidade: string;
}

interface Props {
  disabled: boolean;
  onCompress: (payload: Payload) => void;
}

export function CompressPdfPanel({ disabled, onCompress }: Props) {
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [qualidade, setQualidade] = useState("ebook");

  return (
    <div className="space-y-4">
      <FolderInput label="Pasta de origem (PDFs)" value={origem} onChange={setOrigem} icon="📂" accentColor="text-amber-400" />
      <FolderInput label="Pasta de destino" value={destino} onChange={setDestino} icon="📥" accentColor="text-emerald-400" />
      <div className="border-t pt-4">
        <RadioGroup
          label="Qualidade de saída"
          value={qualidade}
          onChange={setQualidade}
          options={[
            { label: "Screen — menor tamanho (72 dpi)", value: "screen", desc: "ideal para tela" },
            { label: "Ebook — equilíbrio (150 dpi)", value: "ebook", desc: "tablets/e-readers" },
            { label: "Printer — alta qualidade (300 dpi)", value: "printer", desc: "impressão" },
          ]}
        />
        <p className="text-xs text-muted-foreground mt-3">Requer Ghostscript instalado no sistema (gswin64c no PATH).</p>
      </div>
      <button
        onClick={() => onCompress({ pasta_origem: origem, pasta_destino: destino, qualidade })}
        disabled={disabled || !origem || !destino}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-6 py-3
                   text-sm font-semibold text-white hover:bg-amber-700 active:bg-amber-800
                   disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
      >
        COMPRIMIR PDFs
      </button>
    </div>
  );
}
