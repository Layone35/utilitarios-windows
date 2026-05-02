import { useState } from "react";
import { cn } from "../../lib/utils";
import { apiDuplicatasDeletar } from "../../lib/api";
import type { GrupoDuplicata, DuplicatasResultado } from "../../lib/api";
import { Loader2, Trash2, CheckSquare, Square as SquareIcon, ChevronDown, ChevronRight, FileX } from "lucide-react";

interface Props {
  resultado: DuplicatasResultado;
  onLog: (msg: string, nivel: string) => void;
  onResultadoChange: (r: DuplicatasResultado) => void;
}

export function DuplicatasResultados({ resultado, onLog, onResultadoChange }: Props) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [expandidos, setExpandidos] = useState<Set<number>>(() => new Set(resultado.grupos.map((_, i) => i)));
  const [deletando, setDeletando] = useState(false);

  const toggleArquivo = (caminho: string) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(caminho)) next.delete(caminho); else next.add(caminho);
      return next;
    });
  };

  const toggleGrupo = (grupo: GrupoDuplicata) => {
    const caminhos = grupo.arquivos.map((a) => a.caminho);
    const todos = caminhos.every((c) => selecionados.has(c));
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (todos) caminhos.forEach((c) => next.delete(c)); else caminhos.forEach((c) => next.add(c));
      return next;
    });
  };

  const selecionarDuplicatas = () => {
    const next = new Set<string>();
    for (const grupo of resultado.grupos) grupo.arquivos.slice(1).forEach((a) => next.add(a.caminho));
    setSelecionados(next);
  };

  const toggleExpandido = (idx: number) => {
    setExpandidos((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const handleDeletar = async () => {
    if (selecionados.size === 0) return;
    try {
      setDeletando(true);
      const caminhos = Array.from(selecionados);
      const res = await apiDuplicatasDeletar(caminhos);
      onLog(`🗑 ${res.deletados} arquivo(s) deletado(s) — ${res.bytes_liberados_fmt} liberado(s)`, "ok");
      if (res.erros.length > 0) res.erros.forEach((e) => onLog(`⚠️ ${e}`, "warn"));
      setSelecionados(new Set());
      const gruposAtualizados = resultado.grupos
        .map((g) => ({ ...g, arquivos: g.arquivos.filter((a) => !caminhos.includes(a.caminho)) }))
        .filter((g) => g.arquivos.length > 1);
      onResultadoChange({ ...resultado, grupos: gruposAtualizados, total_grupos: gruposAtualizados.length });
    } catch (err) {
      onLog(`❌ Erro ao deletar: ${err}`, "erro");
    } finally {
      setDeletando(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <span className="text-sm font-semibold text-amber-300">{resultado.total_grupos} grupo(s) encontrado(s)</span>
            {resultado.espaco_recuperavel > 0 && (
              <span className="text-xs text-muted-foreground ml-2">— até {resultado.espaco_recuperavel_fmt} recuperáveis</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={selecionarDuplicatas}
              className="text-xs rounded-md border border-amber-500/40 px-3 py-1.5 text-amber-400 hover:bg-amber-500/10 transition-all"
            >
              <CheckSquare className="inline h-3.5 w-3.5 mr-1" />
              Selecionar duplicatas
            </button>
            {selecionados.size > 0 && (
              <button
                onClick={() => setSelecionados(new Set())}
                className="text-xs rounded-md border border-border px-3 py-1.5 text-muted-foreground hover:bg-secondary transition-all"
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

      {resultado.grupos.map((grupo, idx) => {
        const aberto = expandidos.has(idx);
        const caminhos = grupo.arquivos.map((a) => a.caminho);
        const qtdSel = caminhos.filter((c) => selecionados.has(c)).length;
        const todosSel = qtdSel === caminhos.length;
        const parcial = qtdSel > 0 && !todosSel;

        return (
          <div key={`${grupo.tipo}-${idx}`} className="rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-secondary/30 cursor-pointer hover:bg-secondary/50 transition-colors" onClick={() => toggleExpandido(idx)}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleGrupo(grupo); }}
                className="shrink-0 text-muted-foreground hover:text-amber-400 transition-colors"
              >
                {todosSel ? <CheckSquare className="h-4 w-4 text-amber-400" /> : parcial ? <CheckSquare className="h-4 w-4 text-amber-400/50" /> : <SquareIcon className="h-4 w-4" />}
              </button>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium shrink-0", grupo.tipo === "exata" ? "bg-red-500/15 text-red-400" : "bg-blue-500/15 text-blue-400")}>
                {grupo.tipo === "exata" ? "Exata" : "Família"}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-mono text-muted-foreground truncate block">{grupo.chave}</span>
              </div>
              <div className="shrink-0 text-right text-xs text-muted-foreground">
                <span>{grupo.arquivos.length} arquivos</span>
                <span className="ml-2 text-amber-400/80">{grupo.tamanho_total_fmt}</span>
              </div>
              {aberto ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
            </div>

            {aberto && (
              <div className="divide-y divide-border/50">
                {grupo.arquivos.map((arq, aidx) => {
                  const sel = selecionados.has(arq.caminho);
                  return (
                    <div
                      key={arq.caminho}
                      onClick={() => toggleArquivo(arq.caminho)}
                      className={cn("flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors", sel ? "bg-red-500/10 hover:bg-red-500/15" : "hover:bg-secondary/30")}
                    >
                      <div className="shrink-0 text-muted-foreground">
                        {sel ? <CheckSquare className="h-4 w-4 text-red-400" /> : <SquareIcon className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground/50 font-mono w-4 shrink-0">{aidx + 1}</span>
                          <span className={cn("text-sm font-medium truncate", sel && "line-through text-muted-foreground")}>{arq.nome}</span>
                        </div>
                        <div className="text-xs text-muted-foreground/60 truncate ml-6 mt-0.5">{arq.pasta}</div>
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

      {selecionados.size > 0 && (
        <div className="sticky bottom-4">
          <button
            onClick={handleDeletar}
            disabled={deletando}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-3.5
                       text-sm font-semibold text-white hover:bg-red-700 active:bg-red-800
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {deletando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            DELETAR {selecionados.size} ARQUIVO(S) SELECIONADO(S)
          </button>
        </div>
      )}
    </div>
  );
}
