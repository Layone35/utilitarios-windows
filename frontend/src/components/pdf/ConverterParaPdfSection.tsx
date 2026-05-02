import { useState } from "react";
import { cn } from "../../lib/utils";
import { ProgressBar } from "../ui/ProgressBar";
import { apiConvertToPdf, apiCancelPdf, apiBrowseFolder } from "../../lib/api";
import type { WsProgressMessage } from "../../hooks/useWebSocket";
import { Square, FilePlus2, FolderOpen, Loader2 } from "lucide-react";

interface Props {
  progressMap: Record<string, WsProgressMessage>;
  onLog: (msg: string, nivel: string) => void;
}

export function ConverterParaPdfSection({ progressMap, onLog }: Props) {
  const [pastaOrigem, setPastaOrigem] = useState("");
  const [pastaDestino, setPastaDestino] = useState("");
  const [incluirSubs, setIncluirSubs] = useState(false);
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [browsingOrigem, setBrowsingOrigem] = useState(false);
  const [browsingDestino, setBrowsingDestino] = useState(false);

  const progress = taskId ? (progressMap[taskId] ?? null) : null;

  const handleBrowseOrigem = async () => {
    try { setBrowsingOrigem(true); const res = await apiBrowseFolder(); if (res.ok && res.path) setPastaOrigem(res.path); }
    catch { /* silencioso */ } finally { setBrowsingOrigem(false); }
  };

  const handleBrowseDestino = async () => {
    try { setBrowsingDestino(true); const res = await apiBrowseFolder(); if (res.ok && res.path) setPastaDestino(res.path); }
    catch { /* silencioso */ } finally { setBrowsingDestino(false); }
  };

  const handleConverter = async () => {
    if (!pastaOrigem.trim() || !pastaDestino.trim()) { onLog("⚠️ Preencha a pasta de origem e destino.", "warn"); return; }
    try {
      setLoading(true);
      const res = await apiConvertToPdf({ pasta_origem: pastaOrigem, pasta_destino: pastaDestino, incluir_subpastas: incluirSubs });
      if (res) { setTaskId(res.task_id); onLog(`▶ ${res.message}`, "info"); }
    } catch (err) { onLog(`❌ Erro: ${err}`, "erro"); }
    finally { setLoading(false); }
  };

  const handleCancel = async () => {
    if (taskId) { await apiCancelPdf(taskId); onLog("⏹ Cancelamento solicitado.", "warn"); setTaskId(null); }
  };

  const inputCls = "flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none transition-all";
  const browseBtnCls = "shrink-0 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all border-border bg-secondary/50 hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FilePlus2 className="h-5 w-5 text-violet-400" />
          Converter para PDF
        </h3>
        <p className="text-sm text-muted-foreground">Converte .docx, .txt e .md em lote para PDF. Requer LibreOffice instalado.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium flex items-center gap-1.5 text-violet-400"><span>📂</span> Pasta de origem (com .docx/.txt/.md)</label>
        <div className="flex gap-2">
          <input type="text" value={pastaOrigem} onChange={(e) => setPastaOrigem(e.target.value)} placeholder="Ex: D:\Documentos\Relatórios" className={`${inputCls} focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500`} />
          <button onClick={handleBrowseOrigem} disabled={browsingOrigem} className={`${browseBtnCls} hover:border-violet-500/30 text-violet-400`}>
            {browsingOrigem ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
            <span className="hidden sm:inline">Procurar</span>
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium flex items-center gap-1.5 text-emerald-400"><span>📥</span> Pasta de destino (PDFs gerados)</label>
        <div className="flex gap-2">
          <input type="text" value={pastaDestino} onChange={(e) => setPastaDestino(e.target.value)} placeholder="Ex: D:\Documentos\PDFs" className={`${inputCls} focus:ring-2 focus:ring-primary/30 focus:border-primary`} />
          <button onClick={handleBrowseDestino} disabled={browsingDestino} className={`${browseBtnCls} hover:border-emerald-500/30 text-emerald-400`}>
            {browsingDestino ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
            <span className="hidden sm:inline">Procurar</span>
          </button>
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer group">
        <button
          onClick={() => setIncluirSubs(!incluirSubs)}
          className={cn("relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200", incluirSubs ? "bg-violet-500" : "bg-secondary")}
        >
          <span className={cn("pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200", incluirSubs ? "translate-x-5" : "translate-x-0")} />
        </button>
        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Incluir arquivos em subpastas</span>
      </label>

      <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-3 text-xs text-violet-300">
        ℹ️ Requer <strong>LibreOffice</strong> instalado no PC.{" "}
        <span className="opacity-70">Suporta: .docx .doc .odt .txt .md .rtf .pptx .ppt .odp .pps .ppsx</span>
      </div>

      <ProgressBar progress={progress} accentColor="bg-violet-500" />

      <div className="flex gap-3">
        <button
          onClick={handleConverter}
          disabled={loading || !!taskId || !pastaOrigem.trim() || !pastaDestino.trim()}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-6 py-3
                     text-sm font-semibold text-white hover:bg-violet-700 active:bg-violet-800
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <FilePlus2 className="h-4 w-4" />
          CONVERTER PARA PDF
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
