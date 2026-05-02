import { useState } from "react";
import { ProgressBar } from "../ui/ProgressBar";
import { apiRemoveSenhaPdf, apiCancelPdf, apiBrowseFile, apiBrowseFolder } from "../../lib/api";
import type { WsProgressMessage } from "../../hooks/useWebSocket";
import { Square, KeyRound, FolderOpen, Loader2 } from "lucide-react";

interface Props {
  progressMap: Record<string, WsProgressMessage>;
  onLog: (msg: string, nivel: string) => void;
}

export function RemoverSenhaSection({ progressMap, onLog }: Props) {
  const [arqEntrada, setArqEntrada] = useState("");
  const [arqSaida, setArqSaida] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [browsingFile, setBrowsingFile] = useState(false);
  const [browsingOutput, setBrowsingOutput] = useState(false);

  const progress = taskId ? (progressMap[taskId] ?? null) : null;

  const handleBrowseFile = async () => {
    try {
      setBrowsingFile(true);
      const res = await apiBrowseFile("pdf");
      if (res.ok && res.path) setArqEntrada(res.path);
    } catch { /* silencioso */ } finally { setBrowsingFile(false); }
  };

  const handleBrowseOutput = async () => {
    try {
      setBrowsingOutput(true);
      const res = await apiBrowseFolder();
      if (res.ok && res.path) {
        const nomeBase = arqEntrada
          ? arqEntrada.replace(/\.pdf$/i, "_sem_senha.pdf").split(/[\\/]/).pop()!
          : "arquivo_sem_senha.pdf";
        setArqSaida(`${res.path}\\${nomeBase}`);
      }
    } catch { /* silencioso */ } finally { setBrowsingOutput(false); }
  };

  const handleRemover = async () => {
    if (!arqEntrada.trim() || !senha.trim()) {
      onLog("⚠️ Preencha o arquivo de entrada e a senha.", "warn");
      return;
    }
    try {
      setLoading(true);
      const res = await apiRemoveSenhaPdf({ arquivo_entrada: arqEntrada, senha, arquivo_saida: arqSaida });
      if (res) { setTaskId(res.task_id); onLog(`▶ ${res.message}`, "info"); }
    } catch (err) { onLog(`❌ Erro: ${err}`, "erro"); }
    finally { setLoading(false); }
  };

  const handleCancel = async () => {
    if (taskId) { await apiCancelPdf(taskId); onLog("⏹ Cancelamento solicitado.", "warn"); setTaskId(null); }
  };

  const inputCls = "flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all";
  const browseBtnCls = "shrink-0 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all border-border bg-secondary/50 hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-amber-400" />
          Remover Senha do PDF
        </h3>
        <p className="text-sm text-muted-foreground">Abre o PDF com a senha fornecida e salva uma cópia desprotegida.</p>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium flex items-center gap-1.5 text-amber-400"><span>📄</span> Arquivo PDF com senha</label>
        <div className="flex gap-2">
          <input type="text" value={arqEntrada} onChange={(e) => setArqEntrada(e.target.value)} placeholder="Ex: D:\Downloads\fatura.pdf" className={inputCls} />
          <button onClick={handleBrowseFile} disabled={browsingFile} className={`${browseBtnCls} hover:border-amber-500/30 text-amber-400`}>
            {browsingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
            <span className="hidden sm:inline">Procurar</span>
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium flex items-center gap-1.5 text-amber-400"><span>🔑</span> Senha</label>
        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Digite a senha do PDF"
          className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium flex items-center gap-1.5 text-emerald-400">
          <span>📥</span> Arquivo de saída <span className="text-xs text-muted-foreground font-normal">(opcional — padrão: _sem_senha.pdf)</span>
        </label>
        <div className="flex gap-2">
          <input type="text" value={arqSaida} onChange={(e) => setArqSaida(e.target.value)} placeholder="Ex: D:\Downloads\fatura_aberta.pdf" className={`${inputCls} focus:ring-primary/30 focus:border-primary`} />
          <button onClick={handleBrowseOutput} disabled={browsingOutput} className={`${browseBtnCls} hover:border-emerald-500/30 text-emerald-400`}>
            {browsingOutput ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
            <span className="hidden sm:inline">Procurar</span>
          </button>
        </div>
      </div>

      <ProgressBar progress={progress} accentColor="bg-amber-500" />

      <div className="flex gap-3">
        <button
          onClick={handleRemover}
          disabled={loading || !!taskId || !arqEntrada.trim() || !senha.trim()}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-6 py-3
                     text-sm font-semibold text-white hover:bg-amber-700 active:bg-amber-800
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <KeyRound className="h-4 w-4" />
          REMOVER SENHA
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
