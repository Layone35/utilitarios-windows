import { useState, useEffect } from "react";
import { cn } from "../lib/utils";
import { FolderInput } from "./ui/FolderInput";
import { ProgressBar } from "./ui/ProgressBar";
import {
  apiDuplicatasScan,
  apiDuplicatasResultado,
  apiDuplicatasDeletar,
  apiCancelDuplicatas,
} from "../lib/api";
import type {
  GrupoDuplicata,
  DuplicatasResultado,
} from "../lib/api";
import type { WsProgressMessage } from "../hooks/useWebSocket";
import {
  Copy,
  FolderSearch,
  Loader2,
  Square,
  Trash2,
  ChevronDown,
  ChevronRight,
  FileX,
  CheckSquare,
  Square as SquareIcon,
} from "lucide-react";

interface DuplicatasTabProps {
  progress: WsProgressMessage | null;
  taskComplete: WsProgressMessage | null;
  onLog: (msg: string, nivel: string) => void;
}

export function DuplicatasTab({ progress, taskComplete, onLog }: DuplicatasTabProps) {
  const [pasta, setPasta] = useState("");
  const [recursivo, setRecursivo] = useState(true);
  const [modo, setModo] = useState("3"); // 1=exatas, 2=familias, 3=ambos
  const [taskId, setTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<DuplicatasResultado | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [deletando, setDeletando] = useState(false);

  // Quando task concluída, busca os resultados
  useEffect(() => {
    if (taskComplete && taskComplete.task_id === taskId) {
      apiDuplicatasResultado(taskComplete.task_id)
        .then((res) => {
          setResultado(res);
          // Expande todos os grupos automaticamente
          setExpandidos(new Set(res.grupos.map((_, i) => i)));
          setSelecionados(new Set());
        })
        .catch(() => onLog("❌ Erro ao buscar resultados.", "erro"))
        .finally(() => setTaskId(null));
    }
  }, [taskComplete, taskId, onLog]);

  const handleScan = async () => {
    if (!pasta.trim()) {
      onLog("⚠️ Informe a pasta para escanear.", "warn");
      return;
    }
    try {
      setLoading(true);
      setResultado(null);
      setSelecionados(new Set());
      const res = await apiDuplicatasScan({
        pasta: pasta.trim(),
        recursivo,
        modo,
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
      await apiCancelDuplicatas(taskId);
      onLog("⏹ Cancelamento solicitado.", "warn");
      setTaskId(null);
    }
  };

  const toggleArquivo = (caminho: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(caminho)) next.delete(caminho);
      else next.add(caminho);
      return next;
    });
  };

  const toggleGrupo = (grupo: GrupoDuplicata) => {
    const todosNeste = grupo.arquivos.map((a) => a.caminho);
    const todosSelecionados = todosNeste.every((c) => selecionados.has(c));
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (todosSelecionados) {
        todosNeste.forEach((c) => next.delete(c));
      } else {
        todosNeste.forEach((c) => next.add(c));
      }
      return next;
    });
  };

  // Seleciona todos menos o primeiro de cada grupo (manter o mais antigo)
  const selecionarDuplicatas = () => {
    if (!resultado) return;
    const next = new Set<string>();
    for (const grupo of resultado.grupos) {
      // Pula o primeiro (mantém), seleciona os demais
      grupo.arquivos.slice(1).forEach((a) => next.add(a.caminho));
    }
    setSelecionados(next);
  };

  const limparSelecao = () => setSelecionados(new Set());

  const toggleExpandido = (idx: number) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleDeletar = async () => {
    if (selecionados.size === 0) return;
    try {
      setDeletando(true);
      const caminhos = Array.from(selecionados);
      const res = await apiDuplicatasDeletar(caminhos);
      onLog(
        `🗑 ${res.deletados} arquivo(s) deletado(s) — ${res.bytes_liberados_fmt} liberado(s)`,
        "ok",
      );
      if (res.erros.length > 0) {
        res.erros.forEach((e) => onLog(`⚠️ ${e}`, "warn"));
      }
      // Remove arquivos deletados dos resultados
      setSelecionados(new Set());
      setResultado((prev) => {
        if (!prev) return prev;
        const gruposAtualizados = prev.grupos
          .map((g) => ({
            ...g,
            arquivos: g.arquivos.filter((a) => !caminhos.includes(a.caminho)),
          }))
          .filter((g) => g.arquivos.length > 1);
        return { ...prev, grupos: gruposAtualizados, total_grupos: gruposAtualizados.length };
      });
    } catch (err) {
      onLog(`❌ Erro ao deletar: ${err}`, "erro");
    } finally {
      setDeletando(false);
    }
  };

  const modos = [
    { value: "1", label: "Duplicatas exatas", desc: "Mesmo conteúdo (MD5)" },
    { value: "2", label: "Famílias por nome", desc: "Ex: relatorio.pdf + relatorio_assinado.pdf" },
    { value: "3", label: "Ambos", desc: "Exatas + famílias" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-amber-500/10 p-3">
          <Copy className="h-6 w-6 text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Scanner de Duplicatas</h3>
          <p className="text-sm text-muted-foreground">
            Encontra arquivos duplicados ou com nomes relacionados para liberar espaço.
          </p>
        </div>
      </div>

      {/* Pasta */}
      <FolderInput
        label="Pasta para Escanear"
        value={pasta}
        onChange={setPasta}
        icon="📂"
        accentColor="text-amber-400"
      />

      {/* Subpastas toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setRecursivo((v) => !v)}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
            recursivo ? "bg-amber-500" : "bg-secondary",
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition duration-200",
              recursivo ? "translate-x-5" : "translate-x-0",
            )}
          />
        </button>
        <span className="text-sm text-muted-foreground">Incluir subpastas</span>
      </div>

      {/* Modo */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-amber-400">Modo de Busca</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {modos.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setModo(m.value)}
              className={cn(
                "rounded-lg border p-3 text-left text-sm transition-all",
                modo === m.value
                  ? "border-amber-500 bg-amber-500/10 text-amber-300"
                  : "border-border bg-secondary/30 text-muted-foreground hover:border-amber-500/40",
              )}
            >
              <div className="font-medium">{m.label}</div>
              <div className="text-xs mt-0.5 opacity-70">{m.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Progress */}
      <ProgressBar progress={progress} accentColor="bg-amber-500" />

      {/* Botões scan */}
      <div className="flex gap-3">
        <button
          onClick={handleScan}
          disabled={loading || !!taskId || !pasta.trim()}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-6 py-3
                     text-sm font-semibold text-white hover:bg-amber-700 active:bg-amber-800
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FolderSearch className="h-4 w-4" />
          )}
          ESCANEAR PASTA
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

      {/* Resultados */}
      {resultado && (
        <div className="space-y-4">
          {/* Resumo */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="text-sm font-semibold text-amber-300">
                  {resultado.total_grupos} grupo(s) encontrado(s)
                </span>
                {resultado.espaco_recuperavel > 0 && (
                  <span className="text-xs text-muted-foreground ml-2">
                    — até {resultado.espaco_recuperavel_fmt} recuperáveis
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={selecionarDuplicatas}
                  className="text-xs rounded-md border border-amber-500/40 px-3 py-1.5
                             text-amber-400 hover:bg-amber-500/10 transition-all"
                >
                  <CheckSquare className="inline h-3.5 w-3.5 mr-1" />
                  Selecionar duplicatas
                </button>
                {selecionados.size > 0 && (
                  <button
                    onClick={limparSelecao}
                    className="text-xs rounded-md border border-border px-3 py-1.5
                               text-muted-foreground hover:bg-secondary transition-all"
                  >
                    Limpar seleção
                  </button>
                )}
              </div>
            </div>
          </div>

          {resultado.grupos.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <FileX className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum duplicado encontrado nesta pasta.</p>
            </div>
          )}

          {/* Lista de grupos */}
          {resultado.grupos.map((grupo, idx) => {
            const aberto = expandidos.has(idx);
            const todosNeste = grupo.arquivos.map((a) => a.caminho);
            const qtdSelecionados = todosNeste.filter((c) => selecionados.has(c)).length;
            const todosSelecionados = qtdSelecionados === todosNeste.length;
            const parcial = qtdSelecionados > 0 && !todosSelecionados;

            return (
              <div
                key={`${grupo.tipo}-${idx}`}
                className="rounded-xl border border-border overflow-hidden"
              >
                {/* Header do grupo */}
                <div
                  className="flex items-center gap-3 px-4 py-3 bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => toggleExpandido(idx)}
                >
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleGrupo(grupo); }}
                    className="shrink-0 text-muted-foreground hover:text-amber-400 transition-colors"
                  >
                    {todosSelecionados ? (
                      <CheckSquare className="h-4 w-4 text-amber-400" />
                    ) : parcial ? (
                      <CheckSquare className="h-4 w-4 text-amber-400/50" />
                    ) : (
                      <SquareIcon className="h-4 w-4" />
                    )}
                  </button>

                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium shrink-0",
                      grupo.tipo === "exata"
                        ? "bg-red-500/15 text-red-400"
                        : "bg-blue-500/15 text-blue-400",
                    )}
                  >
                    {grupo.tipo === "exata" ? "Exata" : "Família"}
                  </span>

                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-mono text-muted-foreground truncate block">
                      {grupo.chave}
                    </span>
                  </div>

                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    <span>{grupo.arquivos.length} arquivos</span>
                    <span className="ml-2 text-amber-400/80">{grupo.tamanho_total_fmt}</span>
                  </div>

                  {aberto ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>

                {/* Arquivos do grupo */}
                {aberto && (
                  <div className="divide-y divide-border/50">
                    {grupo.arquivos.map((arq, aidx) => {
                      const sel = selecionados.has(arq.caminho);
                      return (
                        <div
                          key={arq.caminho}
                          onClick={() => toggleArquivo(arq.caminho)}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                            sel
                              ? "bg-red-500/10 hover:bg-red-500/15"
                              : "hover:bg-secondary/30",
                          )}
                        >
                          <div className="shrink-0 text-muted-foreground">
                            {sel ? (
                              <CheckSquare className="h-4 w-4 text-red-400" />
                            ) : (
                              <SquareIcon className="h-4 w-4" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground/50 font-mono w-4 shrink-0">
                                {aidx + 1}
                              </span>
                              <span className={cn("text-sm font-medium truncate", sel && "line-through text-muted-foreground")}>
                                {arq.nome}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground/60 truncate ml-6 mt-0.5">
                              {arq.pasta}
                            </div>
                          </div>

                          <div className="shrink-0 text-right text-xs text-muted-foreground space-y-0.5">
                            <div>{arq.tamanho_fmt}</div>
                            <div className="opacity-60">{arq.data_mod}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Botão deletar */}
          {selecionados.size > 0 && (
            <div className="sticky bottom-4">
              <button
                onClick={handleDeletar}
                disabled={deletando}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-3.5
                           text-sm font-semibold text-white hover:bg-red-700 active:bg-red-800
                           disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
              >
                {deletando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                DELETAR {selecionados.size} ARQUIVO(S) SELECIONADO(S)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
