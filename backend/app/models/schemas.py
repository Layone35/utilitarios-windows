"""Modelos Pydantic para requests/responses da API."""
from pydantic import BaseModel, Field
from enum import Enum


# ── Enums ─────────────────────────────────────────────────────────
class VideoCodec(str, Enum):
    copy = "copy"
    h264 = "h264"
    h265 = "h265"


class VideoPreset(str, Enum):
    ultrafast = "ultrafast"
    veryfast = "veryfast"
    fast = "fast"
    medium = "medium"


class VideoFormat(str, Enum):
    mp4 = "mp4"
    mkv = "mkv"
    avi = "avi"
    mov = "mov"
    webm = "webm"


class AudioFormat(str, Enum):
    mp3 = "mp3"
    aac = "aac"
    wav = "wav"
    flac = "flac"
    ogg = "ogg"
    m4a = "m4a"
    opus = "opus"


class VideoResolution(str, Enum):
    original = "original"
    r1080 = "1080"
    r720 = "720"
    r480 = "480"


class ImageFormat(str, Enum):
    original = "original"
    jpeg = "jpeg"
    webp = "webp"
    png = "png"


class ImageScale(str, Enum):
    original = "original"
    s75 = "75"
    s50 = "50"
    s25 = "25"


class PdfQuality(str, Enum):
    screen = "screen"
    ebook = "ebook"
    printer = "printer"


class AudioBitrate(str, Enum):
    b64 = "64"
    b96 = "96"
    b128 = "128"
    b192 = "192"
    b256 = "256"
    b320 = "320"


class CompressAudioBitrate(str, Enum):
    b64k = "64k"
    b96k = "96k"
    b128k = "128k"
    b192k = "192k"


class GpuAccel(str, Enum):
    cpu = "cpu"
    nvenc = "nvenc"
    amf = "amf"
    qsv = "qsv"


# ── Video Requests ────────────────────────────────────────────────
class ConvertVideoRequest(BaseModel):
    pasta_origem: str = Field(..., description="Caminho da pasta com vídeos de origem")
    pasta_destino: str = Field(..., description="Caminho da pasta de destino")
    formato: VideoFormat = Field(default=VideoFormat.mp4)
    codec: VideoCodec = Field(default=VideoCodec.copy)
    crf: int = Field(default=23, ge=0, le=51)
    preset: VideoPreset = Field(default=VideoPreset.fast)
    modo_ts: bool = Field(default=False, description="Se True, converte apenas .ts → .mp4")
    incluir_subpastas: bool = Field(default=True, description="Buscar arquivos em subpastas")


# ── Audio Requests ────────────────────────────────────────────────
class ExtractAudioRequest(BaseModel):
    pasta_origem: str
    pasta_destino: str
    formato: AudioFormat = Field(default=AudioFormat.mp3)
    bitrate: AudioBitrate = Field(default=AudioBitrate.b192)
    manter_nome: bool = Field(default=True)
    incluir_subpastas: bool = Field(default=True, description="Buscar arquivos em subpastas")


class ConvertAudioRequest(BaseModel):
    pasta_origem: str
    pasta_destino: str
    formato: AudioFormat = Field(default=AudioFormat.mp3)
    bitrate: AudioBitrate = Field(default=AudioBitrate.b192)
    incluir_subpastas: bool = Field(default=True, description="Buscar arquivos em subpastas")


# ── Folders Requests ──────────────────────────────────────────────
class ExtractArchiveRequest(BaseModel):
    pasta_origem: str
    pasta_destino: str
    incluir_subpastas: bool = Field(default=True, description="Buscar arquivos em subpastas")


class FlattenFolderRequest(BaseModel):
    pasta_origem: str
    pasta_destino: str
    mover: bool = Field(default=False, description="Se True, move os arquivos em vez de copiar")
    preservar_ordem: bool = Field(default=True, description="Prefixar nome com caminho das pastas para manter ordem")
    extensoes: list[str] | None = Field(default=None, description="Filtrar por extensões (ex: .mp4, .pdf)")


class OrganizeFolderRequest(BaseModel):
    pasta_origem: str
    pasta_destino: str
    mover: bool = Field(default=False, description="Se True, move os arquivos em vez de copiar")
    incluir_subpastas: bool = Field(default=True, description="Buscar arquivos em subpastas")


class OrganizePorDataRequest(BaseModel):
    pasta_origem: str
    pasta_destino: str
    mover: bool = Field(default=False, description="Se True, move os arquivos em vez de copiar")
    incluir_subpastas: bool = Field(default=True, description="Buscar arquivos em subpastas")
    fallback_data_arquivo: bool = Field(default=True, description="Usar data de modificação do arquivo se não houver EXIF/nome")


class ListFilesRequest(BaseModel):
    pasta: str
    extensoes: list[str] | None = None


# ── Compress Requests ─────────────────────────────────────────────
class CompressVideoRequest(BaseModel):
    pasta_origem: str
    pasta_destino: str
    crf: int = Field(default=28, ge=0, le=51)
    resolucao: VideoResolution = Field(default=VideoResolution.original)
    codec: VideoCodec = Field(default=VideoCodec.h264)
    preset: VideoPreset = Field(default=VideoPreset.veryfast)
    gpu: GpuAccel = Field(default=GpuAccel.cpu)
    incluir_subpastas: bool = Field(default=True, description="Buscar arquivos em subpastas")


class CompressAudioRequest(BaseModel):
    pasta_origem: str
    pasta_destino: str
    bitrate: CompressAudioBitrate = Field(default=CompressAudioBitrate.b128k)
    incluir_subpastas: bool = Field(default=True, description="Buscar arquivos em subpastas")


class CompressImageRequest(BaseModel):
    pasta_origem: str
    pasta_destino: str
    qualidade: int = Field(default=75, ge=10, le=95)
    escala: ImageScale = Field(default=ImageScale.original)
    formato: ImageFormat = Field(default=ImageFormat.original)
    incluir_subpastas: bool = Field(default=True, description="Buscar arquivos em subpastas")


class CompressPdfRequest(BaseModel):
    pasta_origem: str
    pasta_destino: str
    qualidade: PdfQuality = Field(default=PdfQuality.ebook)
    incluir_subpastas: bool = Field(default=True, description="Buscar arquivos em subpastas")


# ── PDF Merge Requests ───────────────────────────────────────
class MergePdfRequest(BaseModel):
    pasta_origem: str = Field(..., description="Pasta contendo os PDFs a juntar")
    arquivo_saida: str = Field(..., description="Caminho completo do PDF de saída")
    ordenar_por_nome: bool = Field(default=True, description="Ordenar arquivos alfabeticamente")
    incluir_subpastas: bool = Field(default=True, description="Buscar PDFs em subpastas")


class RemoveSenhaPdfRequest(BaseModel):
    arquivo_entrada: str = Field(..., description="Caminho do PDF com senha")
    senha: str = Field(..., description="Senha do PDF")
    arquivo_saida: str = Field(default="", description="Caminho de saída (vazio = _sem_senha.pdf)")


# ── B3 COTAHIST Requests ────────────────────────────────────────
class B3ParseRequest(BaseModel):
    pasta_ou_arquivo: str = Field(..., description="Pasta com TXTs ou caminho de arquivo único")
    ticker: str = Field(..., description="Código do ativo (ex: PETR4, VALE3)")
    pasta_destino: str = Field(default="", description="Pasta de destino do CSV (vazio = mesmo local do arquivo)")
    apenas_vista: bool = Field(default=True, description="Filtrar apenas mercado à vista (TPMERC=010)")
    incluir_fracionario: bool = Field(default=False, description="Incluir mercado fracionário (TPMERC=020)")


# ── Convert to PDF Requests ─────────────────────────────────────
class ConvertToPdfRequest(BaseModel):
    pasta_origem: str = Field(..., description="Pasta contendo os arquivos a converter")
    pasta_destino: str = Field(..., description="Pasta de destino dos PDFs gerados")
    incluir_subpastas: bool = Field(default=False, description="Buscar também em subpastas")


# ── Responses ─────────────────────────────────────────────────────
class TaskResponse(BaseModel):
    task_id: str
    message: str


class FileInfo(BaseModel):
    nome: str
    tamanho: int
    caminho: str


class ListFilesResponse(BaseModel):
    arquivos: list[FileInfo]
    total: int


class HealthResponse(BaseModel):
    status: str
    ffmpeg: bool
    version: str = "2.0.0"
