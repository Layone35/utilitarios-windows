import { useState } from "react";
import { FolderInput } from "./ui/FolderInput";
import { ProgressBar } from "./ui/ProgressBar";
import { apiExtractArchives, apiCancelFolder, apiFlattenFolder, apiOrganizeFolder, apiCancelOrganize, apiOrganizePorData, apiCancelOrganizePorData } from "../lib/api";
import type { WsProgressMessage } from "../hooks/useWebSocket";
import { Play, Square, FileArchive, FolderOutput, FolderKanban, CalendarDays } from "lucide-react";

interface FoldersTabProps {
  progress: WsProgressMessage | null;
  onLog: (msg: string, nivel: string) => void;
}

export function FoldersTab({ progress, onLog }: FoldersTabProps) {
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [extSubpastas, setExtSubpastas] = useState(true);

  // Estado para organizar por tipo
  const [orgOrigem, setOrgOrigem] = useState("");
  const [orgDestino, setOrgDestino] = useState("");
  const [orgMover, setOrgMover] = useState(false);
  const [orgSubpastas, setOrgSubpastas] = useState(true);
  const [orgTaskId, setOrgTaskId] = useState<string | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);

  // Estado para achatar pastas
  const [flatOrigem, setFlatOrigem] = useState("");
  const [flatDestino, setFlatDestino] = useState("");
  const [flatMover, setFlatMover] = useState(false);
  const [flatPreservarOrdem, setFlatPreservarOrdem] = useState(true);
  const [flatTaskId, setFlatTaskId] = useState<string | null>(null);
  const [flatLoading, setFlatLoading] = useState(false);

  // Estado para organizar por data
  const [dataOrigem, setDataOrigem] = useState("");
  const [dataDestino, setDataDestino] = useState("");
  const [dataMover, setDataMover] = useState(false);
  const [dataSubpastas, setDataSubpastas] = useState(true);
  const [dataFallback, setDataFallback] = useState(true);
  const [dataTaskId, setDataTaskId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  const handleExtract = async () => {
    if (!origem || !destino) {
      onLog("⚠️ Selecione as pastas de origem e destino!", "warn");
      return;
    }
    try {
      setLoading(true);
      const res = await apiExtractArchives({
        pasta_origem: origem,
        pasta_destino: destino,
        incluir_subpastas: extSubpastas,
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
      await apiCancelFolder(taskId);
      onLog("⏹ Cancelamento solicitado.", "warn");
      setTaskId(null);
    }
  };

  const handleFlatten = async () => {
    if (!flatOrigem || !flatDestino) {
      onLog("⚠️ Selecione as pastas de origem e destino!", "warn");
      return;
    }
    try {
      setFlatLoading(true);
      const res = await apiFlattenFolder({
        pasta_origem: flatOrigem,
        pasta_destino: flatDestino,
        mover: flatMover,
        preservar_ordem: flatPreservarOrdem,
      });
      setFlatTaskId(res.task_id);
      onLog(`▶ ${res.message}`, "info");
    } catch (err) {
      onLog(`❌ Erro: ${err}`, "erro");
    } finally {
      setFlatLoading(false);
    }
  };

  const handleOrganize = async () => {
    if (!orgOrigem || !orgDestino) {
      onLog("⚠️ Selecione as pastas de origem e destino!", "warn");
      return;
    }
    try {
      setOrgLoading(true);
      const res = await apiOrganizeFolder({
        pasta_origem: orgOrigem,
        pasta_destino: orgDestino,
        mover: orgMover,
        incluir_subpastas: orgSubpastas,
      });
      setOrgTaskId(res.task_id);
      onLog(`▶ ${res.message}`, "info");
    } catch (err) {
      onLog(`❌ Erro: ${err}`, "erro");
    } finally {
      setOrgLoading(false);
    }
  };

  const handleOrganizeCancel = async () => {
    if (orgTaskId) {
      await apiCancelOrganize(orgTaskId);
      onLog("⏹ Cancelamento solicitado.", "warn");
      setOrgTaskId(null);
    }
  };

  const handleFlattenCancel = async () => {
    if (flatTaskId) {
      await apiCancelFolder(flatTaskId);
      onLog("⏹ Cancelamento solicitado.", "warn");
      setFlatTaskId(null);
    }
  };

  const handleOrganizarPorData = async () => {
    if (!dataOrigem || !dataDestino) {
      onLog("⚠️ Selecione as pastas de origem e destino!", "warn");
      return;
    }
    try {
      setDataLoading(true);
      const res = await apiOrganizePorData({
        pasta_origem: dataOrigem,
        pasta_destino: dataDestino,
        mover: dataMover,
        incluir_subpastas: dataSubpastas,
        fallback_data_arquivo: dataFallback,
      });
      setDataTaskId(res.task_id);
      onLog(`▶ ${res.message}`, "info");
    } catch (err) {
      onLog(`❌ Erro: ${err}`, "erro");
    } finally {
      setDataLoading(false);
    }
  };

  const handleOrganizarPorDataCancel = async () => {
    if (dataTaskId) {
      await apiCancelOrganizePorData(dataTaskId);
      onLog("⏹ Cancelamento solicitado.", "warn");
      setDataTaskId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-orange-500/10 p-3">
          <FileArchive className="h-6 w-6 text-orange-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Extrator de Arquivos</h3>
          <p className="text-sm text-muted-foreground">
            Extrai arquivos ZIP, RAR, 7z e TAR automaticamente.
          </p>
        </div>
      </div>

      <FolderInput
        label="Pasta com arquivos compactados"
        value={origem}
        onChange={setOrigem}
        icon="📦"
        accentColor="text-orange-400"
      />
      <FolderInput
        label="Pasta de destino"
        value={destino}
        onChange={setDestino}
        icon="📥"
        accentColor="text-emerald-400"
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setExtSubpastas((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            extSubpastas ? "bg-orange-600" : "bg-slate-600"
          }`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            extSubpastas ? "translate-x-6" : "translate-x-1"
          }`} />
        </button>
        <span className="text-sm text-muted-foreground">
          {extSubpastas ? "Incluindo arquivos em subpastas" : "Apenas pasta principal (sem subpastas)"}
        </span>
      </div>

      <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 p-4">
        <p className="text-sm text-amber-300/80">
          💡 <strong>Formatos suportados:</strong> .zip, .rar, .7z, .tar,
          .tar.gz, .tgz, .bz2, .xz
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Para .rar e .7z é necessário ter{" "}
          <code className="text-amber-400/80">7-Zip</code> instalado.
        </p>
      </div>

      <ProgressBar progress={progress} accentColor="bg-orange-500" />

      <div className="flex gap-3">
        <button
          onClick={handleExtract}
          disabled={loading || !!taskId}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-6 py-3
                     text-sm font-semibold text-white hover:bg-orange-700 active:bg-orange-800
                     disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <Play className="h-4 w-4" />
          EXTRAIR ARQUIVOS
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

      {/* Divisor */}
      <div className="border-t border-border/50" />

      {/* ── Organizar por Tipo ──────────────────────────────────── */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-sky-500/10 p-3">
            <FolderKanban className="h-6 w-6 text-sky-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Organizar por Tipo</h3>
            <p className="text-sm text-muted-foreground">
              Separa arquivos em pastas: Vídeos, Áudios, Imagens, Documentos...
            </p>
          </div>
        </div>

        <FolderInput
          label="Pasta de origem (bagunçada)"
          value={orgOrigem}
          onChange={setOrgOrigem}
          icon="📂"
          accentColor="text-sky-400"
        />
        <FolderInput
          label="Pasta de destino (organizada)"
          value={orgDestino}
          onChange={setOrgDestino}
          icon="📥"
          accentColor="text-emerald-400"
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOrgMover((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              orgMover ? "bg-sky-600" : "bg-slate-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                orgMover ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-sm text-muted-foreground">
            {orgMover ? (
              <span className="text-amber-400 font-medium">Mover arquivos (remove os originais)</span>
            ) : (
              "Copiar arquivos (mantém os originais)"
            )}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOrgSubpastas((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              orgSubpastas ? "bg-sky-600" : "bg-slate-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                orgSubpastas ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-sm text-muted-foreground">
            {orgSubpastas ? "Incluindo arquivos em subpastas" : "Apenas pasta principal (sem subpastas)"}
          </span>
        </div>

        <div className="rounded-xl border border-dashed border-sky-500/30 bg-sky-500/5 p-4 space-y-1">
          <p className="text-sm text-sky-300/80">
            💡 <strong>Pastas criadas automaticamente:</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            Vídeos · Áudios · Imagens · Documentos · Compactados · Código · Programas · Outros
          </p>
        </div>

        <ProgressBar progress={progress} accentColor="bg-sky-500" />

        <div className="flex gap-3">
          <button
            onClick={handleOrganize}
            disabled={orgLoading || !!orgTaskId}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-6 py-3
                       text-sm font-semibold text-white hover:bg-sky-700 active:bg-sky-800
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <Play className="h-4 w-4" />
            ORGANIZAR ARQUIVOS
          </button>
          {orgTaskId && (
            <button
              onClick={handleOrganizeCancel}
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
      <div className="border-t border-border/50" />

      {/* ── Organizar por Data ─────────────────────────────────── */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-teal-500/10 p-3">
            <CalendarDays className="h-6 w-6 text-teal-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Organizar por Data</h3>
            <p className="text-sm text-muted-foreground">
              Separa fotos e vídeos em pastas por ano e mês.
            </p>
          </div>
        </div>

        <FolderInput
          label="Pasta com fotos/vídeos (bagunçados)"
          value={dataOrigem}
          onChange={setDataOrigem}
          icon="📷"
          accentColor="text-teal-400"
        />
        <FolderInput
          label="Pasta de destino (organizada)"
          value={dataDestino}
          onChange={setDataDestino}
          icon="📥"
          accentColor="text-emerald-400"
        />

        {/* Toggle mover/copiar */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDataMover((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              dataMover ? "bg-teal-600" : "bg-slate-600"
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              dataMover ? "translate-x-6" : "translate-x-1"
            }`} />
          </button>
          <span className="text-sm text-muted-foreground">
            {dataMover ? (
              <span className="text-amber-400 font-medium">Mover arquivos (remove os originais)</span>
            ) : (
              "Copiar arquivos (mantém os originais)"
            )}
          </span>
        </div>

        {/* Toggle subpastas */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDataSubpastas((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              dataSubpastas ? "bg-teal-600" : "bg-slate-600"
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              dataSubpastas ? "translate-x-6" : "translate-x-1"
            }`} />
          </button>
          <span className="text-sm text-muted-foreground">
            {dataSubpastas ? "Incluindo arquivos em subpastas" : "Apenas pasta principal (sem subpastas)"}
          </span>
        </div>

        {/* Toggle fallback data do arquivo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDataFallback((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              dataFallback ? "bg-teal-600" : "bg-slate-600"
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              dataFallback ? "translate-x-6" : "translate-x-1"
            }`} />
          </button>
          <span className="text-sm text-muted-foreground">
            {dataFallback
              ? "Usar data do arquivo se não houver EXIF/nome"
              : "Ignorar arquivos sem data no EXIF ou no nome"}
          </span>
        </div>

        <div className="rounded-xl border border-dashed border-teal-500/30 bg-teal-500/5 p-4 space-y-2">
          <p className="text-sm text-teal-300/80">
            💡 <strong>Estrutura criada automaticamente:</strong>
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            Fotos/<span className="text-teal-400">2024</span>/<span className="text-teal-400">03 - Março</span>/foto.jpg
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            Vídeos/<span className="text-teal-400">2024</span>/<span className="text-teal-400">03 - Março</span>/video.mp4
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Prioridade de data: EXIF → nome do arquivo → data de modificação
          </p>
        </div>

        <ProgressBar progress={progress} accentColor="bg-teal-500" />

        <div className="flex gap-3">
          <button
            onClick={handleOrganizarPorData}
            disabled={dataLoading || !!dataTaskId}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-6 py-3
                       text-sm font-semibold text-white hover:bg-teal-700 active:bg-teal-800
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <Play className="h-4 w-4" />
            ORGANIZAR POR DATA
          </button>
          {dataTaskId && (
            <button
              onClick={handleOrganizarPorDataCancel}
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
      <div className="border-t border-border/50" />

      {/* ── Achatar Pastas ─────────────────────────────────────── */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-violet-500/10 p-3">
            <FolderOutput className="h-6 w-6 text-violet-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Achatar Pastas</h3>
            <p className="text-sm text-muted-foreground">
              Reúne todos os arquivos de subpastas em uma única pasta.
            </p>
          </div>
        </div>

        <FolderInput
          label="Pasta de origem (com subpastas)"
          value={flatOrigem}
          onChange={setFlatOrigem}
          icon="📂"
          accentColor="text-violet-400"
        />
        <FolderInput
          label="Pasta de destino (pasta única)"
          value={flatDestino}
          onChange={setFlatDestino}
          icon="📥"
          accentColor="text-emerald-400"
        />

        {/* Opção mover / copiar */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setFlatMover((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              flatMover ? "bg-violet-600" : "bg-slate-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                flatMover ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-sm text-muted-foreground">
            {flatMover ? (
              <span className="text-amber-400 font-medium">Mover arquivos (remove os originais)</span>
            ) : (
              "Copiar arquivos (mantém os originais)"
            )}
          </span>
        </div>

        {/* Toggle preservar ordem */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setFlatPreservarOrdem((v) => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              flatPreservarOrdem ? "bg-violet-600" : "bg-slate-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                flatPreservarOrdem ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-sm text-muted-foreground">
            {flatPreservarOrdem ? (
              <span className="text-violet-300 font-medium">Preservar ordem (prefixo de pasta)</span>
            ) : (
              "Sem prefixo (só o nome do arquivo)"
            )}
          </span>
        </div>

        <div className="rounded-xl border border-dashed border-violet-500/30 bg-violet-500/5 p-4 space-y-2">
          {flatPreservarOrdem ? (
            <>
              <p className="text-sm text-violet-300/80">
                📚 <strong>Ideal para cursos:</strong> o nome da pasta vira prefixo do arquivo.
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                Módulo 1/Aula 01.mp4 → <span className="text-violet-400">Módulo 1 - Aula 01.mp4</span>
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                Módulo 2/Aula 01.mp4 → <span className="text-violet-400">Módulo 2 - Aula 01.mp4</span>
              </p>
            </>
          ) : (
            <p className="text-sm text-violet-300/80">
              💡 Nomes duplicados recebem sufixo <code className="text-violet-400/80">_2</code>, <code className="text-violet-400/80">_3</code>, etc.
            </p>
          )}
        </div>

        <ProgressBar progress={progress} accentColor="bg-violet-500" />

        <div className="flex gap-3">
          <button
            onClick={handleFlatten}
            disabled={flatLoading || !!flatTaskId}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-6 py-3
                       text-sm font-semibold text-white hover:bg-violet-700 active:bg-violet-800
                       disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <Play className="h-4 w-4" />
            ACHATAR PASTAS
          </button>
          {flatTaskId && (
            <button
              onClick={handleFlattenCancel}
              className="flex items-center gap-2 rounded-lg bg-red-600/20 px-6 py-3 text-sm
                         font-semibold text-red-400 hover:bg-red-600/30 transition-all"
            >
              <Square className="h-4 w-4" />
              PARAR
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
