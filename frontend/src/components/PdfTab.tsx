import type { WsProgressMessage } from "../hooks/useWebSocket";
import { RemoverSenhaSection } from "./pdf/RemoverSenhaSection";
import { ConverterParaPdfSection } from "./pdf/ConverterParaPdfSection";
import { JuntarPdfsSection } from "./pdf/JuntarPdfsSection";

interface PdfTabProps {
  progressMap: Record<string, WsProgressMessage>;
  onLog: (msg: string, nivel: string) => void;
}

export function PdfTab({ progressMap, onLog }: PdfTabProps) {
  return (
    <div className="space-y-8">
      <RemoverSenhaSection progressMap={progressMap} onLog={onLog} />
      <div className="border-t border-border/60" />
      <ConverterParaPdfSection progressMap={progressMap} onLog={onLog} />
      <div className="border-t border-border/60" />
      <JuntarPdfsSection progressMap={progressMap} onLog={onLog} />
    </div>
  );
}
