import { useState } from "react";
import { cn } from "../lib/utils";
import { FolderInput } from "./ui/FolderInput";
import { ProgressBar } from "./ui/ProgressBar";
import { apiB3Parse, apiCancelB3, apiBrowseFile, apiBrowseFolder } from "../lib/api";
import type { WsProgressMessage } from "../hooks/useWebSocket";
import { Play, Square, TrendingUp, FileSearch, Loader2, FolderOpen } from "lucide-react";

interface B3TabProps {
  progressMap: Record<string, WsProgressMessage>;
  onLog: (msg: string, nivel: string) => void;
}

export function B3Tab({ progressMap, onLog }: B3TabProps) {
  const [pastaOuArquivo, setPastaOuArquivo] = useState("");
  const [pastaDestino, setPastaDestino] = useState("");
  const [ticker, setTicker] = useState("");
  const [apenasVista, setApenasVista] = useState(true);
  const [incluirFracionario, setIncluirFracionario] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const progress = taskId ? (progressMap[taskId] ?? null) : null;
  const [loading, setLoading] = useState(false);
  const [browsingFile, setBrowsingFile] = useState(false);

  const handleBrowseFile = async () => {
    try {
      setBrowsingFile(true);
      // Tenta abrir como arquivo TXT; se cancelar ou falhar, abre como pasta
      const res = await apiBrowseFile("txt");
      if (res.ok && res.path) {
        setPastaOuArquivo(res.path);
      } else {
        const res2 = await apiBrowseFolder();
        if (res2.ok && res2.path) setPastaOuArquivo(res2.path);
      }
    } catch {
      // silencioso
    } finally {
      setBrowsingFile(false);
    }
  };

  const handleStart = async () => {
    const t = ticker.trim().toUpperCase();
    if (!pastaOuArquivo.trim()) {
      onLog("⚠️ Informe a pasta ou arquivo TXT da B3.", "warn");
      return;
    }
    if (!t) {
      onLog("⚠️ Informe o código do ativo (ex: PETR4).", "warn");
      return;
    }
    try {
      setLoading(true);
      const res = await apiB3Parse({
        pasta_ou_arquivo: pastaOuArquivo.trim(),
        ticker: t,
        pasta_destino: pastaDestino.trim(),
        apenas_vista: apenasVista,
        incluir_fracionario: incluirFracionario,
      });
      setTaskId(res.task_id);
      onLog(`▶ ${res.message}`, "info");
    } catch (err) {
      onLog(`❌ Erro: ${err}`, "erro");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (taskId) {
      await apiCancelB3(taskId);
      onLog("⏹ Cancelamento solicitado.", "warn");
      setTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-emerald-500/10 p-3">
          <TrendingUp className="h-6 w-6 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Parser B3 — COTAHIST</h3>
          <p className="text-sm text-muted-foreground">
            Extrai dados de um ativo específico do arquivo de série histórica da B3.
          </p>
        </div>
      </div>

      {/* Origem — pasta ou arquivo */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium flex items-center gap-1.5 text-emerald-400">
          <span>📂</span> Pasta ou Arquivo TXT (COTAHIST)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={pastaOuArquivo}
            onChange={(e) => setPastaOuArquivo(e.target.value)}
            placeholder="Ex: D:\Downloads\COTAHIST_A2025 ou D:\...\COTAHIST_A2025.TXT"
            className="flex-1 rounded-lg border border-border bg-background px-4 py-2.5 text-sm
                       text-foreground placeholder:text-muted-foreground/50
                       focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500
                       transition-all"
          />
          <button
            onClick={handleBrowseFile}
            disabled={browsingFile}
            title="Selecionar arquivo TXT"
            className="shrink-0 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm
                       font-medium transition-all border-border bg-secondary/50 hover:bg-secondary
                       hover:border-emerald-500/30 text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {browsingFile ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FolderOpen className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Procurar</span>
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Aceita uma pasta (processa todos os .TXT) ou um arquivo único.
        </p>
      </div>

      {/* Ticker */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium flex items-center gap-1.5 text-emerald-400">
          <FileSearch className="h-4 w-4" /> Código do Ativo (Ticker)
        </label>
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="Ex: PETR4, VALE3, ITUB4, BBDC4..."
          maxLength={12}
          className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm
                     text-foreground placeholder:text-muted-foreground/50 uppercase
                     focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500
                     transition-all font-mono"
        />
      </div>

      {/* Pasta destino */}
      <FolderInput
        label="Pasta de Destino do CSV (opcional)"
        value={pastaDestino}
        onChange={setPastaDestino}
        icon="📥"
        accentColor="text-emerald-400"
      />

      {/* Filtros de mercado */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Tipo de Mercado</p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setApenasVista((v) => !v)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
              apenasVista ? "bg-emerald-500" : "bg-secondary",
            )}
          >
            <span className={cn(
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200",
              apenasVista ? "translate-x-5" : "translate-x-0",
            )} />
          </button>
          <span className="text-sm text-muted-foreground">
            Mercado à Vista <span className="text-xs text-emerald-400/70 font-mono">(TPMERC=010)</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIncluirFracionario((v) => !v)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
              incluirFracionario ? "bg-emerald-500" : "bg-secondary",
            )}
          >
            <span className={cn(
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200",
              incluirFracionario ? "translate-x-5" : "translate-x-0",
            )} />
          </button>
          <span className="text-sm text-muted-foreground">
            Mercado Fracionário <span className="text-xs text-muted-foreground/60 font-mono">(TPMERC=020)</span>
          </span>
        </div>
      </div>

      {/* Info box */}
      <div className="rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
        <p className="text-sm text-emerald-300/80">
          📊 <strong>Colunas do CSV gerado:</strong>
        </p>
        <p className="text-xs text-muted-foreground font-mono">
          data · codigo · nome · abertura · maxima · minima · media · fechamento · ultimo · negocios · quantidade · volume_r
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Arquivo salvo como <span className="text-emerald-400 font-mono">{ticker || "TICKER"}_COTAHIST.csv</span> na pasta de destino.
        </p>
      </div>

      {/* Progresso */}
      <ProgressBar progress={progress} accentColor="bg-emerald-500" />

      {/* Botões */}
      <div className="flex gap-3">
        <button
          onClick={handleStart}
          disabled={loading || !!taskId || !pastaOuArquivo.trim() || !ticker.trim()}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3
                     text-sm font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <Play className="h-4 w-4" />
          EXTRAIR {ticker || "TICKER"} → CSV
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
  );
}
