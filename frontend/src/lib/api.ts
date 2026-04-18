/**
 * Cliente HTTP para comunicação com o backend FastAPI.
 */

const API_BASE = "http://127.0.0.1:8010";

type RequestBody = Record<string, unknown>;

async function request<T>(
  path: string,
  options?: { method?: string; body?: RequestBody },
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: options?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API Error ${res.status}: ${error}`);
  }

  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────
export interface TaskResponse {
  task_id: string;
  message: string;
}

export interface HealthResponse {
  status: string;
  ffmpeg: boolean;
  version: string;
}

export interface FileInfo {
  nome: string;
  tamanho: number;
  caminho: string;
}

export interface ListFilesResponse {
  arquivos: FileInfo[];
  total: number;
}

export interface BrowseResponse {
  path: string;
  ok: boolean;
}

// ── Health ───────────────────────────────────────────────────────
export const apiHealthCheck = () => request<HealthResponse>("/");

// ── Utils (Browse de pastas/arquivos) ───────────────────────────
export const apiBrowseFolder = () =>
  request<BrowseResponse>("/api/utils/browse");

export const apiBrowseFile = (filetypes = "pdf") =>
  request<BrowseResponse>(`/api/utils/browse-file?filetypes=${filetypes}`);

// ── Video ────────────────────────────────────────────────────────
export const apiConvertVideo = (body: RequestBody) =>
  request<TaskResponse>("/api/video/convert", { method: "POST", body });

export const apiCancelVideo = (taskId: string) =>
  request<{ cancelado: boolean }>(`/api/video/cancel/${taskId}`, {
    method: "POST",
  });

// ── Audio ────────────────────────────────────────────────────────
export const apiExtractAudio = (body: RequestBody) =>
  request<TaskResponse>("/api/audio/extract", { method: "POST", body });

export const apiConvertAudio = (body: RequestBody) =>
  request<TaskResponse>("/api/audio/convert", { method: "POST", body });

export const apiCancelAudio = (taskId: string) =>
  request<{ cancelado: boolean }>(`/api/audio/cancel/${taskId}`, {
    method: "POST",
  });

// ── Folders ──────────────────────────────────────────────────────
export const apiExtractArchives = (body: RequestBody) =>
  request<TaskResponse>("/api/folders/extract", { method: "POST", body });

export const apiListFiles = (body: RequestBody) =>
  request<ListFilesResponse>("/api/folders/list", { method: "POST", body });

export const apiCancelFolder = (taskId: string) =>
  request<{ cancelado: boolean }>(`/api/folders/cancel/${taskId}`, {
    method: "POST",
  });

export const apiFlattenFolder = (body: RequestBody) =>
  request<TaskResponse>("/api/folders/flatten", { method: "POST", body });

// ── Compress ─────────────────────────────────────────────────────
export const apiCompressVideo = (body: RequestBody) =>
  request<TaskResponse>("/api/compress/video", { method: "POST", body });

export const apiCompressAudio = (body: RequestBody) =>
  request<TaskResponse>("/api/compress/audio", { method: "POST", body });

export const apiCompressImage = (body: RequestBody) =>
  request<TaskResponse>("/api/compress/image", { method: "POST", body });

export const apiCompressPdf = (body: RequestBody) =>
  request<TaskResponse>("/api/compress/pdf", { method: "POST", body });

export const apiCancelCompress = (taskId: string) =>
  request<{ cancelado: boolean }>(`/api/compress/cancel/${taskId}`, {
    method: "POST",
  });

// ── Organizar ────────────────────────────────────────────────────
export const apiOrganizeFolder = (body: RequestBody) =>
  request<TaskResponse>("/api/organize/run", { method: "POST", body });

export const apiCancelOrganize = (taskId: string) =>
  request<{ cancelado: boolean }>(`/api/organize/cancel/${taskId}`, {
    method: "POST",
  });

export const apiOrganizePorData = (body: RequestBody) =>
  request<TaskResponse>("/api/organize/por-data", { method: "POST", body });

export const apiCancelOrganizePorData = (taskId: string) =>
  request<{ cancelado: boolean }>(`/api/organize/cancel/${taskId}`, {
    method: "POST",
  });

// ── PDF (Juntar/Mesclar + Remover Senha) ────────────────────────
export const apiMergePdf = (body: RequestBody) =>
  request<TaskResponse>("/api/pdf/merge", { method: "POST", body });

export const apiRemoveSenhaPdf = (body: RequestBody) =>
  request<TaskResponse>("/api/pdf/remove-senha", { method: "POST", body });

export const apiCancelPdf = (taskId: string) =>
  request<{ cancelado: boolean }>(`/api/pdf/cancel/${taskId}`, {
    method: "POST",
  });

// ── PDF → Converter para PDF ─────────────────────────────────────
export const apiConvertToPdf = (body: RequestBody) =>
  request<TaskResponse>("/api/pdf/convert-to-pdf", { method: "POST", body });

// ── Duplicatas ───────────────────────────────────────────────────
export interface ArquivoInfo {
  caminho: string;
  nome: string;
  pasta: string;
  tamanho: number;
  tamanho_fmt: string;
  data_mod: string;
}

export interface GrupoDuplicata {
  tipo: "exata" | "familia";
  chave: string;
  arquivos: ArquivoInfo[];
  tamanho_total: number;
  tamanho_total_fmt: string;
  espaco_recuperavel: number;
  espaco_recuperavel_fmt: string;
}

export interface DuplicatasResultado {
  grupos: GrupoDuplicata[];
  total_grupos: number;
  espaco_recuperavel: number;
  espaco_recuperavel_fmt: string;
}

export interface DeletarResponse {
  deletados: number;
  erros: string[];
  bytes_liberados: number;
  bytes_liberados_fmt: string;
}

export const apiDuplicatasScan = (body: RequestBody) =>
  request<TaskResponse>("/api/duplicatas/scan", { method: "POST", body });

export const apiDuplicatasResultado = (taskId: string) =>
  request<DuplicatasResultado>(`/api/duplicatas/resultado/${taskId}`);

export const apiDuplicatasDeletar = (caminhos: string[]) =>
  request<DeletarResponse>("/api/duplicatas/deletar", {
    method: "POST",
    body: { caminhos } as unknown as RequestBody,
  });

export const apiCancelDuplicatas = (taskId: string) =>
  request<{ cancelado: boolean }>(`/api/duplicatas/cancel/${taskId}`, {
    method: "POST",
  });

// ── B3 COTAHIST ──────────────────────────────────────────────────
export const apiB3Parse = (body: RequestBody) =>
  request<TaskResponse>("/api/b3/parse", { method: "POST", body });

export const apiCancelB3 = (taskId: string) =>
  request<{ cancelado: boolean }>(`/api/b3/cancel/${taskId}`, {
    method: "POST",
  });
