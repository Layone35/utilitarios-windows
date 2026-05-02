import { useState } from "react";
import { cn } from "../../lib/utils";
import { FolderInput } from "../ui/FolderInput";
import { ProgressBar } from "../ui/ProgressBar";
import { apiMergePdf, apiCancelPdf, apiListFiles, apiBrowseFolder } from "../../lib/api";
import type { WsProgressMessage } from "../../hooks/useWebSocket";
import type { FileInfo } from "../../lib/api";
import { Play, Square, FileText, ArrowDownUp, Trash2, FolderOpen, Loader2 } from "lucide-react";

interface Props {
  progressMap: Record<string, WsProgressMessage>;
  onLog: (msg: string, nivel: string) => void;
}

const fmtBytes = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`;

export function JuntarPdfsSection({ progressMap, onLog }: Props) {
  const [pasta, setPasta] = useState("");
  const [saida, setSaida] = useState("");
  const [ordenar, setOrdenar] = useState(true);
  const [subpastas, setSubpastas] = useState(true);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfs, setPdfs] = useState<FileInfo[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [browsingOutput, setBrowsingOutput] = useState(false);

  const progress = taskId ? (progressMap[taskId] ?? null) : null;

  const handleLoadPdfs = async () => {
    if (!pasta.trim()) return;
    try {
      setLoadingList(true);
      const res = await apiListFiles({ pasta, extensoes: [".pdf"] });
      setPdfs(res.arquivos);
      if (!saida && res.total > 0) setSaida(`${pasta}\\documentos_unificados.pdf`);
    } catch (err) { onLog(`❌ Erro ao listar PDFs: ${err}`, "erro"); }
    finally { setLoadingList(false); }
  };

  const handleBrowseOutput = async () => {
    try {
      setBrowsingOutput(true);
      const res = await apiBrowseFolder();
      if (res.ok && res.path) setSaida(`${res.path}\\documentos_unificados.pdf`);
    } catch { /* silencioso */ } finally { setBrowsingOutput(false); }
  };

  const handleMerge = async () => {
    if (!pasta.trim() || !saida.trim()) { onLog("⚠️ Preencha a pasta de origem e o arquivo de saída.", "warn"); return; }
    try {
      setLoading(true);
      const res = await apiMergePdf({ pasta_origem: pasta, arquivo_saida: saida, ordenar_por_nome: ordenar, incluir_subpastas: subpastas });
      if (res) { setTaskId(res.task_id); onLog(`▶ ${res.message}`, "info"); }
    } catch (err) { onLog(`❌ Erro: ${err}`, "erro"); }
    finally { setLoading(false); }
  };

  const handleCancel = async () => {
    if (taskId) { await apiCancelPdf(taskId); onLog("⏹ Cancelamento solicitado.", "warn"); setTaskId(null); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-rose-400" />
          Juntar PDFs
        </h3>
        <p className="text-sm text-muted-foreground">Mescla múltiplos PDFs em um único arquivo. Suporta PDFs com assinatura digital — o conteúdo visual é preservado.</p>
      </div>

      <FolderInput label="Pasta com os PDFs" value={pasta} onChange={(v) => { setPasta(v); setPdfs([]); }} icon="📂" accentColor="text-rose-400" />

      {pasta.trim() && (
        <button onClick={handleLoadPdfs} disabled={loadingList} className="text-sm font-medium text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-1.5 disabled:opacity-50">
          <ArrowDownUp className="h-3.5 w-3.5" />
          {loadingList ? "Carregando..." : "Carregar lista de PDFs"}
        </button>
      )}

      {pdfs.length > 0 && (
        <div className="rounded-xl border bg-card/50 overflow-hidden">
          <div className="px-4 py-3 border-b bg-secondary/30 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">📄 {pdfs.length} PDF(s) encontrado(s)</span>
            <button onClick={() => setPdfs([])} className="text-xs text-muted-foreground hover:text-red-400 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-48 overflow-auto divide-y divide-border/50">
            {pdfs.map((pdf, idx) => (
              <div key={pdf.caminho} className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/20 transition-colors">
                <span className="text-xs text-muted-foreground/60 w-6 text-right shrink-0">{idx + 1}.</span>
                <FileText className="h-4 w-4 text-rose-400/60 shrink-0" />
                <span className="text-sm truncate flex-1" title={pdf.nome}>{pdf.nome}</span>
                <span className="text-xs text-muted-foreground shrink-0">{fmtBytes(pdf.tamanho)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium flex items-center gap-1.5 text-emerald-400"><span>📥</span> Arquivo de saída</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={saida}
            onChange={(e) => setSaida(e.target.value)}
            placeholder="Ex: D:\Documentos\resultado.pdf"
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
          <button onClick={handleBrowseOutput} disabled={browsingOutput} className="shrink-0 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all border-border bg-secondary/50 hover:bg-secondary hover:border-emerald-500/30 text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed">
            {browsingOutput ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
            <span className="hidden sm:inline">Procurar</span>
          </button>
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer group">
        <button onClick={() => setSubpastas(!subpastas)} className={cn("relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200", subpastas ? "bg-rose-500" : "bg-secondary")}>
          <span className={cn("pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200", subpastas ? "translate-x-5" : "translate-x-0")} />
        </button>
        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
          {subpastas ? "Incluindo PDFs em subpastas" : "Apenas pasta principal (sem subpastas)"}
        </span>
      </label>

      <label className="flex items-center gap-3 cursor-pointer group">
        <button onClick={() => setOrdenar(!ordenar)} className={cn("relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200", ordenar ? "bg-rose-500" : "bg-secondary")}>
          <span className={cn("pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200", ordenar ? "translate-x-5" : "translate-x-0")} />
        </button>
        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Ordenar arquivos por nome (A→Z)</span>
      </label>

      <ProgressBar progress={progress} accentColor="bg-rose-500" />

      <div className="flex gap-3">
        <button
          onClick={handleMerge}
          disabled={loading || !!taskId || !pasta.trim() || !saida.trim()}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-6 py-3
                     text-sm font-semibold text-white hover:bg-rose-700 active:bg-rose-800
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <Play className="h-4 w-4" />
          JUNTAR PDFs
        </button>
        {taskId && (
          <button onClick={handleCancel} className="flex items-center gap-2 rounded-lg bg-red-600/20 px-6 py-3 text-sm font-semibold text-red-400 hover:bg-red-600/30 transition-all">
            <Square className="h-4 w-4" />
            PARAR
          </button>
        )}
      </div>
    </div>
  );
}
