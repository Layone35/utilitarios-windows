import { useState, useEffect, useCallback } from "react";
import {
  FolderSync,
  Video,
  Music,
  Wrench,
  Settings,
  FileArchive,
  FileText,
  TrendingUp,
  Copy,
  Power,
} from "lucide-react";
import { cn } from "./lib/utils";
import { useWebSocket } from "./hooks/useWebSocket";
import { apiHealthCheck } from "./lib/api";
import { VideoTab } from "./components/VideoTab";
import { AudioTab } from "./components/AudioTab";
import { FoldersTab } from "./components/FoldersTab";
import { ExtrasTab } from "./components/ExtrasTab";
import { PdfTab } from "./components/PdfTab";
import { B3Tab } from "./components/B3Tab";
import { DuplicatasTab } from "./components/DuplicatasTab";
import { LogPanel } from "./components/ui/LogPanel";

const TABS = [
  {
    id: "inicio",
    label: "Início",
    icon: FolderSync,
    desc: "Visão Geral e Status",
  },
  { id: "video", label: "Vídeo", icon: Video, desc: "Conversão e Compressão" },
  { id: "audio", label: "Áudio", icon: Music, desc: "Extração e Formatos" },
  {
    id: "arquivos",
    label: "Pastas & ZIPs",
    icon: FileArchive,
    desc: "ZIP, RAR e Organização",
  },
  {
    id: "extras",
    label: "Ferramentas Extras",
    icon: Wrench,
    desc: "Compressão de Mídias",
  },
  {
    id: "pdf",
    label: "PDF",
    icon: FileText,
    desc: "Juntar e Mesclar",
  },
  {
    id: "b3",
    label: "B3 COTAHIST",
    icon: TrendingUp,
    desc: "Extrair dados de ativos",
  },
  {
    id: "duplicatas",
    label: "Duplicatas",
    icon: Copy,
    desc: "Liberar espaço em disco",
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("inicio");
  const [ffmpegOk, setFfmpegOk] = useState<boolean | null>(null);
  const { connected, progress, logs, taskComplete, clearLogs, clearComplete } =
    useWebSocket();

  // Health check ao carregar
  useEffect(() => {
    apiHealthCheck()
      .then((res) => setFfmpegOk(res.ffmpeg))
      .catch(() => setFfmpegOk(false));
  }, []);

  // Limpar estado de task complete quando troca de aba
  useEffect(() => {
    clearComplete();
  }, [activeTab, clearComplete]);

  // Handler de log para componentes filhos
  const handleLog = useCallback((_msg: string, _nivel: string) => {
    // Logs já chegam via WebSocket, este handler é para logs locais
  }, []);

  return (
    <div className="flex h-screen bg-background overflow-hidden text-foreground">
      {/* Sidebar Navigation */}
      <aside className="hidden w-64 flex-col bg-card border-r md:flex">
        <div className="p-6">
          <h2 className="text-xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Settings className="w-6 h-6 animate-[spin_8s_linear_infinite]" />
            Ferramentas do Layone
          </h2>
          <p className="text-xs text-muted-foreground mt-1">v2.0</p>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
                <div className="flex flex-col items-start">
                  <span>{tab.label}</span>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t space-y-3">
          {/* Status FFmpeg */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary/50">
            <span
              className={cn(
                "flex h-2 w-2 rounded-full",
                ffmpegOk === true
                  ? "bg-emerald-500"
                  : ffmpegOk === false
                    ? "bg-red-500"
                    : "bg-yellow-500 animate-pulse",
              )}
            />
            <span className="text-xs text-muted-foreground">
              FFmpeg{" "}
              {ffmpegOk === true
                ? "OK"
                : ffmpegOk === false
                  ? "Ausente"
                  : "Verificando..."}
            </span>
          </div>

          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-destructive transition-all hover:bg-destructive/10">
            <Power className="w-4 h-4" />
            Desligar Servidor
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background/95">
        <header className="flex h-16 shrink-0 items-center justify-between border-b px-6 bg-card/50 backdrop-blur-sm">
          <h1 className="text-xl font-semibold">
            {TABS.find((t) => t.id === activeTab)?.label}
          </h1>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-2 w-2 rounded-full",
                connected ? "bg-green-500 animate-pulse" : "bg-red-500",
              )}
            />
            <span className="text-xs text-muted-foreground">
              {connected ? "Backend Conectado" : "Backend Desconectado"}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 md:p-8">
          <div className="mx-auto max-w-5xl space-y-6">
            {/* ── Início ──────────────────────────────────────── */}
            {activeTab === "inicio" && (
              <div className="space-y-6">
                <div className="flex flex-col space-y-2">
                  <h2 className="text-3xl font-bold tracking-tight">
                    Bem-vindo(a) ao Ferramentas do Layone 👋
                  </h2>
                  <p className="text-muted-foreground">
                    Converta vídeos e áudios, extraia arquivos ZIP/RAR, junte
                    PDFs e muito mais — tudo offline, direto no seu PC, sem
                    instalar nada extra.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {TABS.filter((t) => t.id !== "inicio").map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <div
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className="group rounded-xl border bg-card text-card-foreground shadow-sm p-6 cursor-pointer hover:border-primary focus:outline-none transition-all hover:shadow-md hover:-translate-y-1"
                      >
                        <div className="flex items-center gap-4">
                          <div className="rounded-full bg-primary/10 p-3 group-hover:bg-primary/20 transition-colors">
                            <Icon className="h-6 w-6 text-primary" />
                          </div>
                          <div className="space-y-1">
                            <h3 className="font-semibold leading-none mx-0">
                              {tab.label}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {tab.desc}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Status cards */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border bg-card p-4">
                    <div className="text-sm text-muted-foreground">Backend</div>
                    <div
                      className={cn(
                        "text-lg font-semibold mt-1",
                        connected ? "text-emerald-400" : "text-red-400",
                      )}
                    >
                      {connected ? "🟢 Online" : "🔴 Offline"}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <div className="text-sm text-muted-foreground">FFmpeg</div>
                    <div
                      className={cn(
                        "text-lg font-semibold mt-1",
                        ffmpegOk ? "text-emerald-400" : "text-amber-400",
                      )}
                    >
                      {ffmpegOk ? "✅ Instalado" : "⚠️ Não encontrado"}
                    </div>
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <div className="text-sm text-muted-foreground">
                      WebSocket
                    </div>
                    <div
                      className={cn(
                        "text-lg font-semibold mt-1",
                        connected ? "text-emerald-400" : "text-red-400",
                      )}
                    >
                      {connected ? "🔗 Conectado" : "❌ Desconectado"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Vídeo ───────────────────────────────────────── */}
            <div className={activeTab === "video" ? "" : "hidden"}>
              <VideoTab progress={progress} onLog={handleLog} />
            </div>

            {/* ── Áudio ───────────────────────────────────────── */}
            <div className={activeTab === "audio" ? "" : "hidden"}>
              <AudioTab progress={progress} onLog={handleLog} />
            </div>

            {/* ── Pastas & ZIPs ───────────────────────────────── */}
            <div className={activeTab === "arquivos" ? "" : "hidden"}>
              <FoldersTab progress={progress} onLog={handleLog} />
            </div>

            {/* ── Ferramentas Extras ──────────────────────────── */}
            <div className={activeTab === "extras" ? "" : "hidden"}>
              <ExtrasTab progress={progress} onLog={handleLog} />
            </div>

            {/* ── PDF ─────────────────────────────────────────── */}
            <div className={activeTab === "pdf" ? "" : "hidden"}>
              <PdfTab progress={progress} onLog={handleLog} />
            </div>

            {/* ── B3 COTAHIST ─────────────────────────────────── */}
            <div className={activeTab === "b3" ? "" : "hidden"}>
              <B3Tab progress={progress} onLog={handleLog} />
            </div>

            {/* ── Duplicatas ───────────────────────────────────── */}
            <div className={activeTab === "duplicatas" ? "" : "hidden"}>
              <DuplicatasTab
                progress={progress}
                taskComplete={taskComplete}
                onLog={handleLog}
              />
            </div>

            {/* ── Task Complete Toast ─────────────────────────── */}
            {taskComplete && (
              <div className="fixed bottom-24 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in">
                <div className="rounded-xl border bg-card shadow-xl p-4 max-w-sm">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <div className="font-semibold text-sm">
                        Tarefa Concluída
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {taskComplete.mensagem}
                      </div>
                    </div>
                    <button
                      onClick={clearComplete}
                      className="ml-auto text-muted-foreground hover:text-foreground text-xs"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Log Panel (visível em todas as abas) ────────── */}
            {activeTab !== "inicio" && (
              <LogPanel logs={logs} onClear={clearLogs} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
