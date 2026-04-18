import { useState } from "react";
import { cn } from "../lib/utils";
import { FolderInput } from "./ui/FolderInput";
import { ProgressBar } from "./ui/ProgressBar";
import { apiMergePdf, apiCancelPdf, apiListFiles, apiRemoveSenhaPdf, apiBrowseFile, apiBrowseFolder, apiConvertToPdf } from "../lib/api";
import type { WsProgressMessage } from "../hooks/useWebSocket";
import type { FileInfo } from "../lib/api";
import { Play, Square, FileText, ArrowDownUp, Trash2, KeyRound, FolderOpen, Loader2, FilePlus2 } from "lucide-react";

interface PdfTabProps {
  progressMap: Record<string, WsProgressMessage>;
  onLog: (msg: string, nivel: string) => void;
}

export function PdfTab({ progressMap, onLog }: PdfTabProps) {
  const [pasta, setPasta] = useState("");
  const [saida, setSaida] = useState("");
  const [ordenar, setOrdenar] = useState(true);
  const [mergeSubpastas, setMergeSubpastas] = useState(true);
  const [taskId, setTaskId] = useState<string | null>(null);
  const progress = taskId ? (progressMap[taskId] ?? null) : null;
  const [loading, setLoading] = useState(false);
  const [pdfs, setPdfs] = useState<FileInfo[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Converter para PDF
  const [convPastaOrigem, setConvPastaOrigem] = useState("");
  const [convPastaDestino, setConvPastaDestino] = useState("");
  const [convIncluirSubs, setConvIncluirSubs] = useState(false);
  const [convLoading, setConvLoading] = useState(false);
  const [convTaskId, setConvTaskId] = useState<string | null>(null);
  const [browsingConvOrigem, setBrowsingConvOrigem] = useState(false);
  const [browsingConvDestino, setBrowsingConvDestino] = useState(false);

  // Remover senha
  const [senhaArqEntrada, setSenhaArqEntrada] = useState("");
  const [senhaArqSaida, setSenhaArqSaida] = useState("");
  const [senha, setSenha] = useState("");
  const [senhaLoading, setSenhaLoading] = useState(false);
  const [browsingFile, setBrowsingFile] = useState(false);
  const [browsingOutputSenha, setBrowsingOutputSenha] = useState(false);
  const [browsingOutputMerge, setBrowsingOutputMerge] = useState(false);

  const handleBrowseConvOrigem = async () => {
    try {
      setBrowsingConvOrigem(true);
      const res = await apiBrowseFolder();
      if (res.ok && res.path) setConvPastaOrigem(res.path);
    } catch { /* silencioso */ } finally { setBrowsingConvOrigem(false); }
  };

  const handleBrowseConvDestino = async () => {
    try {
      setBrowsingConvDestino(true);
      const res = await apiBrowseFolder();
      if (res.ok && res.path) setConvPastaDestino(res.path);
    } catch { /* silencioso */ } finally { setBrowsingConvDestino(false); }
  };

  const handleConvertToPdf = async () => {
    if (!convPastaOrigem.trim() || !convPastaDestino.trim()) {
      onLog("⚠️ Preencha a pasta de origem e destino.", "warn");
      return;
    }
    try {
      setConvLoading(true);
      const res = await apiConvertToPdf({
        pasta_origem: convPastaOrigem,
        pasta_destino: convPastaDestino,
        incluir_subpastas: convIncluirSubs,
      });
      if (res) {
        setConvTaskId(res.task_id);
        onLog(`▶ ${res.message}`, "info");
      }
    } catch (err) {
      onLog(`❌ Erro: ${err}`, "erro");
    } finally {
      setConvLoading(false);
    }
  };

  // Carregar lista de PDFs da pasta
  const handleLoadPdfs = async () => {
    if (!pasta.trim()) return;
    try {
      setLoadingList(true);
      const res = await apiListFiles({ pasta, extensoes: [".pdf"] });
      setPdfs(res.arquivos);
      // Sugerir nome de saída
      if (!saida && res.total > 0) {
        setSaida(`${pasta}\\documentos_unificados.pdf`);
      }
    } catch (err) {
      onLog(`❌ Erro ao listar PDFs: ${err}`, "erro");
    } finally {
      setLoadingList(false);
    }
  };

  const handleMerge = async () => {
    if (!pasta.trim() || !saida.trim()) {
      onLog("⚠️ Preencha a pasta de origem e o arquivo de saída.", "warn");
      return;
    }
    try {
      setLoading(true);
      const res = await apiMergePdf({
        pasta_origem: pasta,
        arquivo_saida: saida,
        ordenar_por_nome: ordenar,
        incluir_subpastas: mergeSubpastas,
      });
      if (res) {
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
      await apiCancelPdf(taskId);
      onLog("⏹ Cancelamento solicitado.", "warn");
      setTaskId(null);
    }
  };

  const handleBrowsePdf = async () => {
    try {
      setBrowsingFile(true);
      const res = await apiBrowseFile("pdf");
      if (res.ok && res.path) {
        setSenhaArqEntrada(res.path);
      }
    } catch {
      // silencioso
    } finally {
      setBrowsingFile(false);
    }
  };

  const handleBrowseOutputSenha = async () => {
    try {
      setBrowsingOutputSenha(true);
      const res = await apiBrowseFolder();
      if (res.ok && res.path) {
        const nomeBase = senhaArqEntrada
          ? senhaArqEntrada.replace(/\.pdf$/i, "_sem_senha.pdf").split(/[\\/]/).pop()!
          : "arquivo_sem_senha.pdf";
        setSenhaArqSaida(`${res.path}\\${nomeBase}`);
      }
    } catch { /* silencioso */ } finally {
      setBrowsingOutputSenha(false);
    }
  };

  const handleBrowseOutputMerge = async () => {
    try {
      setBrowsingOutputMerge(true);
      const res = await apiBrowseFolder();
      if (res.ok && res.path) {
        setSaida(`${res.path}\\documentos_unificados.pdf`);
      }
    } catch { /* silencioso */ } finally {
      setBrowsingOutputMerge(false);
    }
  };

  const handleRemoveSenha = async () => {
    if (!senhaArqEntrada.trim() || !senha.trim()) {
      onLog("⚠️ Preencha o arquivo de entrada e a senha.", "warn");
      return;
    }
    try {
      setSenhaLoading(true);
      const res = await apiRemoveSenhaPdf({
        arquivo_entrada: senhaArqEntrada,
        senha,
        arquivo_saida: senhaArqSaida,
      });
      if (res) {
        setTaskId(res.task_id);
        onLog(`▶ ${res.message}`, "info");
      }
    } catch (err) {
      onLog(`❌ Erro: ${err}`, "erro");
    } finally {
      setSenhaLoading(false);
    }
  };

  const fmtBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-8">

      {/* ── Remover Senha ───────────────────────────────────────── */}
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-amber-400" />
            Remover Senha do PDF
          </h3>
          <p className="text-sm text-muted-foreground">
            Abre o PDF com a senha fornecida e salva uma cópia desprotegida.
          </p>
        </div>

        {/* Arquivo de entrada */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium flex items-center gap-1.5 text-amber-400">
            <span>📄</span> Arquivo PDF com senha
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={senhaArqEntrada}
              onChange={(e) => setSenhaArqEntrada(e.target.value)}
              placeholder="Ex: D:\Downloads\fatura.pdf"
              className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm
                         text-foreground placeholder:text-muted-foreground/50
                         focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500
                         transition-all"
            />
            <button
              onClick={handleBrowsePdf}
              disabled={browsingFile}
              title="Selecionar arquivo PDF"
              className="shrink-0 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm
                         font-medium transition-all border-border bg-secondary/50 hover:bg-secondary
                         hover:border-amber-500/30 text-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {browsingFile ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FolderOpen className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Procurar</span>
            </button>
          </div>
        </div>

        {/* Senha */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium flex items-center gap-1.5 text-amber-400">
            <span>🔑</span> Senha
          </label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Digite a senha do PDF"
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm
                       text-foreground placeholder:text-muted-foreground/50
                       focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500
                       transition-all"
          />
        </div>

        {/* Arquivo de saída (opcional) */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium flex items-center gap-1.5 text-emerald-400">
            <span>📥</span> Arquivo de saída{" "}
            <span className="text-xs text-muted-foreground font-normal">(opcional — padrão: _sem_senha.pdf)</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={senhaArqSaida}
              onChange={(e) => setSenhaArqSaida(e.target.value)}
              placeholder="Ex: D:\Downloads\fatura_aberta.pdf"
              className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm
                         text-foreground placeholder:text-muted-foreground/50
                         focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                         transition-all"
            />
            <button
              onClick={handleBrowseOutputSenha}
              disabled={browsingOutputSenha}
              title="Selecionar pasta de destino"
              className="shrink-0 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm
                         font-medium transition-all border-border bg-secondary/50 hover:bg-secondary
                         hover:border-emerald-500/30 text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {browsingOutputSenha ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
              <span className="hidden sm:inline">Procurar</span>
            </button>
          </div>
        </div>

        {/* Progresso remover senha */}
        <ProgressBar progress={taskId ? progress : null} accentColor="bg-amber-500" />

        {/* Botão */}
        <div className="flex gap-3">
          <button
            onClick={handleRemoveSenha}
            disabled={senhaLoading || !!taskId || !senhaArqEntrada.trim() || !senha.trim()}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-6 py-3
                       text-sm font-semibold text-white hover:bg-amber-700 active:bg-amber-800
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <KeyRound className="h-4 w-4" />
            REMOVER SENHA
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

      {/* Divisor */}
      <div className="border-t border-border/60" />

      {/* ── Converter para PDF ──────────────────────────────────────── */}
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FilePlus2 className="h-5 w-5 text-violet-400" />
            Converter para PDF
          </h3>
          <p className="text-sm text-muted-foreground">
            Converte .docx, .txt e .md em lote para PDF. Requer LibreOffice instalado.
          </p>
        </div>

        {/* Pasta origem */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium flex items-center gap-1.5 text-violet-400">
            <span>📂</span> Pasta de origem (com .docx/.txt/.md)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={convPastaOrigem}
              onChange={(e) => setConvPastaOrigem(e.target.value)}
              placeholder="Ex: D:\Documentos\Relatórios"
              className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm
                         text-foreground placeholder:text-muted-foreground/50
                         focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500
                         transition-all"
            />
            <button
              onClick={handleBrowseConvOrigem}
              disabled={browsingConvOrigem}
              title="Selecionar pasta de origem"
              className="shrink-0 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm
                         font-medium transition-all border-border bg-secondary/50 hover:bg-secondary
                         hover:border-violet-500/30 text-violet-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {browsingConvOrigem ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
              <span className="hidden sm:inline">Procurar</span>
            </button>
          </div>
        </div>

        {/* Pasta destino */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium flex items-center gap-1.5 text-emerald-400">
            <span>📥</span> Pasta de destino (PDFs gerados)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={convPastaDestino}
              onChange={(e) => setConvPastaDestino(e.target.value)}
              placeholder="Ex: D:\Documentos\PDFs"
              className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm
                         text-foreground placeholder:text-muted-foreground/50
                         focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                         transition-all"
            />
            <button
              onClick={handleBrowseConvDestino}
              disabled={browsingConvDestino}
              title="Selecionar pasta de destino"
              className="shrink-0 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm
                         font-medium transition-all border-border bg-secondary/50 hover:bg-secondary
                         hover:border-emerald-500/30 text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {browsingConvDestino ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
              <span className="hidden sm:inline">Procurar</span>
            </button>
          </div>
        </div>

        {/* Toggle incluir subpastas */}
        <label className="flex items-center gap-3 cursor-pointer group">
          <button
            onClick={() => setConvIncluirSubs(!convIncluirSubs)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
              convIncluirSubs ? "bg-violet-500" : "bg-secondary",
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200",
                convIncluirSubs ? "translate-x-5" : "translate-x-0",
              )}
            />
          </button>
          <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
            Incluir arquivos em subpastas
          </span>
        </label>

        {/* Aviso LibreOffice */}
        <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 px-4 py-3 text-xs text-violet-300">
          ℹ️ Requer <strong>LibreOffice</strong> instalado no PC.{" "}
          <span className="opacity-70">Suporta: .docx .doc .odt .txt .md .rtf .pptx .ppt .odp .pps .ppsx</span>
        </div>

        {/* Progresso */}
        <ProgressBar progress={convTaskId ? progress : null} accentColor="bg-violet-500" />

        {/* Botões */}
        <div className="flex gap-3">
          <button
            onClick={handleConvertToPdf}
            disabled={convLoading || !!convTaskId || !convPastaOrigem.trim() || !convPastaDestino.trim()}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-6 py-3
                       text-sm font-semibold text-white hover:bg-violet-700 active:bg-violet-800
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <FilePlus2 className="h-4 w-4" />
            CONVERTER PARA PDF
          </button>
          {convTaskId && (
            <button
              onClick={async () => {
                await apiCancelPdf(convTaskId);
                onLog("⏹ Cancelamento solicitado.", "warn");
                setConvTaskId(null);
              }}
              className="flex items-center gap-2 rounded-lg bg-red-600/20 px-6 py-3 text-sm
                         font-semibold text-red-400 hover:bg-red-600/30 transition-all"
            >
              <Square className="h-4 w-4" />
              PARAR
            </button>
          )}
        </div>
      </div>

      {/* Divisor */}
      <div className="border-t border-border/60" />

      {/* ── Juntar PDFs ─────────────────────────────────────────── */}
      <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-rose-400" />
          Juntar PDFs
        </h3>
        <p className="text-sm text-muted-foreground">
          Mescla múltiplos PDFs em um único arquivo. Suporta PDFs com assinatura
          digital — o conteúdo visual é preservado.
        </p>
      </div>

      {/* Pasta de origem */}
      <FolderInput
        label="Pasta com os PDFs"
        value={pasta}
        onChange={(v) => {
          setPasta(v);
          setPdfs([]);
        }}
        icon="📂"
        accentColor="text-rose-400"
      />

      {/* Botão para carregar PDFs */}
      {pasta.trim() && (
        <button
          onClick={handleLoadPdfs}
          disabled={loadingList}
          className="text-sm font-medium text-rose-400 hover:text-rose-300 transition-colors
                     flex items-center gap-1.5 disabled:opacity-50"
        >
          <ArrowDownUp className="h-3.5 w-3.5" />
          {loadingList ? "Carregando..." : "Carregar lista de PDFs"}
        </button>
      )}

      {/* Lista de PDFs encontrados */}
      {pdfs.length > 0 && (
        <div className="rounded-xl border bg-card/50 overflow-hidden">
          <div className="px-4 py-3 border-b bg-secondary/30 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              📄 {pdfs.length} PDF(s) encontrado(s)
            </span>
            <button
              onClick={() => setPdfs([])}
              className="text-xs text-muted-foreground hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-48 overflow-auto divide-y divide-border/50">
            {pdfs.map((pdf, idx) => (
              <div
                key={pdf.caminho}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/20 transition-colors"
              >
                <span className="text-xs text-muted-foreground/60 w-6 text-right shrink-0">
                  {idx + 1}.
                </span>
                <FileText className="h-4 w-4 text-rose-400/60 shrink-0" />
                <span className="text-sm truncate flex-1" title={pdf.nome}>
                  {pdf.nome}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {fmtBytes(pdf.tamanho)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Arquivo de saída */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium flex items-center gap-1.5 text-emerald-400">
          <span>📥</span>
          Arquivo de saída
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={saida}
            onChange={(e) => setSaida(e.target.value)}
            placeholder="Ex: D:\Documentos\resultado.pdf"
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm
                       text-foreground placeholder:text-muted-foreground/50
                       focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
                       transition-all"
          />
          <button
            onClick={handleBrowseOutputMerge}
            disabled={browsingOutputMerge}
            title="Selecionar pasta de destino"
            className="shrink-0 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm
                       font-medium transition-all border-border bg-secondary/50 hover:bg-secondary
                       hover:border-emerald-500/30 text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {browsingOutputMerge ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
            <span className="hidden sm:inline">Procurar</span>
          </button>
        </div>
      </div>

      {/* Toggle subpastas */}
      <label className="flex items-center gap-3 cursor-pointer group">
        <button
          onClick={() => setMergeSubpastas(!mergeSubpastas)}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
            mergeSubpastas ? "bg-rose-500" : "bg-secondary",
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200",
              mergeSubpastas ? "translate-x-5" : "translate-x-0",
            )}
          />
        </button>
        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
          {mergeSubpastas ? "Incluindo PDFs em subpastas" : "Apenas pasta principal (sem subpastas)"}
        </span>
      </label>

      {/* Toggle ordenar */}
      <label className="flex items-center gap-3 cursor-pointer group">
        <button
          onClick={() => setOrdenar(!ordenar)}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
            ordenar ? "bg-rose-500" : "bg-secondary",
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200",
              ordenar ? "translate-x-5" : "translate-x-0",
            )}
          />
        </button>
        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
          Ordenar arquivos por nome (A→Z)
        </span>
      </label>

      {/* Progresso */}
      <ProgressBar progress={progress} accentColor="bg-rose-500" />

      {/* Botões */}
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
      </div>{/* fim Juntar PDFs */}
    </div>
  );
}
