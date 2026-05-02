import type { WsProgressMessage } from "../hooks/useWebSocket";
import { ExtratorSection } from "./folders/ExtratorSection";
import { OrganizarTipoSection } from "./folders/OrganizarTipoSection";
import { OrganizarDataSection } from "./folders/OrganizarDataSection";
import { AchatarSection } from "./folders/AchatarSection";

interface FoldersTabProps {
  progressMap: Record<string, WsProgressMessage>;
  onLog: (msg: string, nivel: string) => void;
}

export function FoldersTab({ progressMap, onLog }: FoldersTabProps) {
  return (
    <div className="space-y-8">
      <ExtratorSection progressMap={progressMap} onLog={onLog} />
      <div className="border-t border-border/50" />
      <OrganizarTipoSection progressMap={progressMap} onLog={onLog} />
      <div className="border-t border-border/50" />
      <OrganizarDataSection progressMap={progressMap} onLog={onLog} />
      <div className="border-t border-border/50" />
      <AchatarSection progressMap={progressMap} onLog={onLog} />
    </div>
  );
}
