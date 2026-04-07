"""Router de compressão — vídeo, áudio, imagem e PDF."""
import os
import asyncio
import subprocess
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks

from app.models.schemas import (
    CompressVideoRequest,
    CompressAudioRequest,
    CompressImageRequest,
    CompressPdfRequest,
    TaskResponse,
)
from app.services.progress import progress_manager

router = APIRouter(prefix="/api/compress", tags=["compress"])

_EXT_VIDEO = {".mp4", ".mkv", ".avi", ".mov", ".m4v", ".wmv", ".flv", ".webm"}
_EXT_AUDIO = {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".wma"}
_EXT_IMG = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp", ".gif", ".heic", ".heif"}


def _fmt_bytes(n: int) -> str:
    for u in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {u}"
        n /= 1024
    return f"{n:.1f} TB"


def _scan(pasta: str, exts: set[str], subpastas: bool) -> list[Path]:
    orig = Path(pasta)
    if subpastas:
        candidatos = (Path(r) / f for r, _, fs in os.walk(pasta) for f in fs)
    else:
        candidatos = (orig / f for f in os.listdir(pasta) if (orig / f).is_file())
    return sorted(p for p in candidatos if p.suffix.lower() in exts)


def _resolver_nome(pasta: str, nome: str) -> Path:
    destino = Path(pasta) / nome
    if not destino.exists():
        return destino
    base = destino.stem
    ext = destino.suffix
    i = 1
    while True:
        novo = Path(pasta) / f"{base}_{i}{ext}"
        if not novo.exists():
            return novo
        i += 1


def _copiar_como_erro(origem: Path, pasta_destino: str) -> Path | None:
    """Copia o original para o destino com sufixo _ERRO para fácil identificação."""
    try:
        import shutil
        dest = _resolver_nome(pasta_destino, f"{origem.stem}_ERRO{origem.suffix}")
        shutil.copy2(str(origem), str(dest))
        return dest
    except Exception:
        return None


# ── Compressão de Vídeo ──────────────────────────────────────────
async def _comprimir_video(req: CompressVideoRequest, task_id: str) -> None:
    pm = progress_manager
    os.makedirs(req.pasta_destino, exist_ok=True)

    arquivos = _scan(req.pasta_origem, _EXT_VIDEO, req.incluir_subpastas)
    if not arquivos:
        await pm.add_log(task_id, "ℹ️ Nenhum vídeo encontrado.", "warn")
        await pm.complete_task(task_id, "Nenhum vídeo encontrado.")
        return

    total = len(arquivos)
    h265 = req.codec.value == "h265"

    # GPU codec mapping
    _GPU_CODEC = {
        ("h264", "nvenc"): ("h264_nvenc", f"-cq {req.crf}", "-preset p2"),
        ("h265", "nvenc"): ("hevc_nvenc", f"-cq {req.crf}", "-preset p2"),
        ("h264", "amf"): ("h264_amf", f"-qp {req.crf}", ""),
        ("h265", "amf"): ("hevc_amf", f"-qp {req.crf}", ""),
        ("h264", "qsv"): ("h264_qsv", f"-q {req.crf}", ""),
        ("h265", "qsv"): ("hevc_qsv", f"-q {req.crf}", ""),
    }
    tipo_codec = "h265" if h265 else "h264"
    gpu_key = (tipo_codec, req.gpu.value)

    ok = err = 0
    for i, arq in enumerate(arquivos, 1):
        task = pm.get_task(task_id)
        if task and task.cancelada:
            break

        await pm.update_progress(task_id, i, total, f"[{i}/{total}] {arq.name}")
        dest_arq = _resolver_nome(req.pasta_destino, arq.stem + ".mp4")

        vf = f"scale=-2:{req.resolucao.value}" if req.resolucao.value != "original" else None

        if req.gpu.value != "cpu" and gpu_key in _GPU_CODEC:
            enc, quality_flag, extra = _GPU_CODEC[gpu_key]
            cmd = ["ffmpeg", "-y", "-i", str(arq), "-c:v", enc]
            cmd += quality_flag.split()
            if extra:
                cmd += extra.split()
            cmd += ["-c:a", "aac", "-b:a", "128k"]
        else:
            codec = "libx265" if h265 else "libx264"
            cmd = [
                "ffmpeg", "-y", "-i", str(arq),
                "-c:v", codec, "-crf", str(req.crf),
                "-preset", req.preset.value,
                "-c:a", "aac", "-b:a", "128k",
            ]

        if vf:
            cmd += ["-vf", vf]
        cmd.append(str(dest_arq))

        try:
            proc = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda c=cmd: subprocess.run(
                    c, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    timeout=3600, creationflags=subprocess.CREATE_NO_WINDOW,
                ),
            )
            if proc.returncode == 0 and dest_arq.exists():
                antes = arq.stat().st_size
                depois = dest_arq.stat().st_size
                pct = int((1 - depois / antes) * 100) if antes else 0
                await pm.add_log(
                    task_id,
                    f"✅ {arq.name} {_fmt_bytes(antes)} → {_fmt_bytes(depois)} (-{pct}%)",
                    "ok",
                )
                ok += 1
            else:
                copia = _copiar_como_erro(arq, req.pasta_destino)
                nome_copia = copia.name if copia else "falha ao copiar"
                await pm.add_log(task_id, f"❌ Erro em {arq.name} → original salvo como '{nome_copia}'", "erro")
                err += 1
        except Exception as e:
            copia = _copiar_como_erro(arq, req.pasta_destino)
            nome_copia = copia.name if copia else "falha ao copiar"
            await pm.add_log(task_id, f"❌ {arq.name}: {e} → original salvo como '{nome_copia}'", "erro")
            err += 1

    msg = f"✅ {ok} vídeo(s) comprimido(s)." + (f" ❌ {err} com erro (originais salvos com _ERRO)." if err else "")
    await pm.complete_task(task_id, msg)


# ── Compressão de Áudio ──────────────────────────────────────────
async def _comprimir_audio(req: CompressAudioRequest, task_id: str) -> None:
    pm = progress_manager
    os.makedirs(req.pasta_destino, exist_ok=True)

    arquivos = _scan(req.pasta_origem, _EXT_AUDIO, req.incluir_subpastas)
    if not arquivos:
        await pm.add_log(task_id, "ℹ️ Nenhum áudio encontrado.", "warn")
        await pm.complete_task(task_id, "Nenhum áudio encontrado.")
        return

    total = len(arquivos)
    ok = err = 0

    for i, arq in enumerate(arquivos, 1):
        task = pm.get_task(task_id)
        if task and task.cancelada:
            break

        await pm.update_progress(task_id, i, total, f"[{i}/{total}] {arq.name}")
        dest_arq = _resolver_nome(req.pasta_destino, arq.stem + ".mp3")

        cmd = [
            "ffmpeg", "-y", "-i", str(arq),
            "-b:a", req.bitrate.value, "-vn",
            str(dest_arq),
        ]

        try:
            proc = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda c=cmd: subprocess.run(
                    c, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    timeout=600, creationflags=subprocess.CREATE_NO_WINDOW,
                ),
            )
            if proc.returncode == 0 and dest_arq.exists():
                antes = arq.stat().st_size
                depois = dest_arq.stat().st_size
                pct = int((1 - depois / antes) * 100) if antes else 0
                await pm.add_log(
                    task_id,
                    f"✅ {arq.name} {_fmt_bytes(antes)} → {_fmt_bytes(depois)} (-{pct}%)",
                    "ok",
                )
                ok += 1
            else:
                copia = _copiar_como_erro(arq, req.pasta_destino)
                nome_copia = copia.name if copia else "falha ao copiar"
                await pm.add_log(task_id, f"❌ Erro em {arq.name} → original salvo como '{nome_copia}'", "erro")
                err += 1
        except Exception as e:
            copia = _copiar_como_erro(arq, req.pasta_destino)
            nome_copia = copia.name if copia else "falha ao copiar"
            await pm.add_log(task_id, f"❌ {arq.name}: {e} → original salvo como '{nome_copia}'", "erro")
            err += 1

    msg = f"✅ {ok} áudio(s) comprimido(s)." + (f" ❌ {err} com erro (originais salvos com _ERRO)." if err else "")
    await pm.complete_task(task_id, msg)


# ── Compressão de Imagem ─────────────────────────────────────────
async def _comprimir_imagem(req: CompressImageRequest, task_id: str) -> None:
    pm = progress_manager
    os.makedirs(req.pasta_destino, exist_ok=True)

    try:
        from PIL import Image
    except ImportError:
        await pm.add_log(task_id, "❌ Pillow não instalado. Execute: pip install pillow", "erro")
        await pm.complete_task(task_id, "Pillow não instalado.")
        return

    arquivos = _scan(req.pasta_origem, _EXT_IMG, req.incluir_subpastas)
    if not arquivos:
        await pm.add_log(task_id, "ℹ️ Nenhuma imagem encontrada.", "warn")
        await pm.complete_task(task_id, "Nenhuma imagem encontrada.")
        return

    total = len(arquivos)
    ok = err = 0

    for i, arq in enumerate(arquivos, 1):
        task = pm.get_task(task_id)
        if task and task.cancelada:
            break

        await pm.update_progress(task_id, i, total, f"[{i}/{total}] {arq.name}")

        try:
            def _process(arq=arq):
                img = Image.open(arq).convert("RGB")

                # Redimensionar
                if req.escala.value != "original":
                    fator = int(req.escala.value) / 100
                    w = max(1, int(img.width * fator))
                    h = max(1, int(img.height * fator))
                    img = img.resize((w, h), Image.LANCZOS)

                # Formato de saída
                fmt = req.formato.value
                qual = req.qualidade
                if fmt == "original":
                    ext = arq.suffix.lower()
                    if ext in (".jpg", ".jpeg"):
                        ext_out, pil_fmt = ".jpg", "JPEG"
                    elif ext == ".webp":
                        ext_out, pil_fmt = ".webp", "WEBP"
                    elif ext == ".png":
                        ext_out, pil_fmt = ".png", "PNG"
                        qual = None
                    else:
                        ext_out, pil_fmt = ".jpg", "JPEG"
                elif fmt == "jpeg":
                    ext_out, pil_fmt = ".jpg", "JPEG"
                elif fmt == "webp":
                    ext_out, pil_fmt = ".webp", "WEBP"
                else:
                    ext_out, pil_fmt = ".png", "PNG"
                    qual = None

                dest_arq = _resolver_nome(req.pasta_destino, arq.stem + ext_out)
                save_kw = {} if pil_fmt == "PNG" else {"quality": qual, "optimize": True}
                img.save(str(dest_arq), pil_fmt, **save_kw)
                return dest_arq

            dest_arq = await asyncio.get_event_loop().run_in_executor(None, _process)

            antes = arq.stat().st_size
            depois = dest_arq.stat().st_size
            pct = int((1 - depois / antes) * 100) if antes else 0
            await pm.add_log(
                task_id,
                f"✅ {arq.name} {_fmt_bytes(antes)} → {_fmt_bytes(depois)} (-{pct}%)",
                "ok",
            )
            ok += 1
        except Exception as e:
            copia = _copiar_como_erro(arq, req.pasta_destino)
            nome_copia = copia.name if copia else "falha ao copiar"
            await pm.add_log(task_id, f"❌ {arq.name}: {e} → original salvo como '{nome_copia}'", "erro")
            err += 1

    msg = f"✅ {ok} imagem(ns) comprimida(s)." + (f" ❌ {err} com erro (originais salvos com _ERRO)." if err else "")
    await pm.complete_task(task_id, msg)


# ── Compressão de PDF ────────────────────────────────────────────
async def _comprimir_pdf(req: CompressPdfRequest, task_id: str) -> None:
    pm = progress_manager
    os.makedirs(req.pasta_destino, exist_ok=True)

    arquivos = _scan(req.pasta_origem, {".pdf"}, req.incluir_subpastas)
    if not arquivos:
        await pm.add_log(task_id, "ℹ️ Nenhum PDF encontrado.", "warn")
        await pm.complete_task(task_id, "Nenhum PDF encontrado.")
        return

    # Detectar Ghostscript
    gs_cmd = None
    for cmd_name in ("gswin64c", "gswin32c", "gs"):
        try:
            subprocess.run([cmd_name, "--version"], capture_output=True, timeout=3)
            gs_cmd = cmd_name
            break
        except (FileNotFoundError, subprocess.TimeoutExpired):
            pass

    if not gs_cmd:
        await pm.add_log(
            task_id,
            "❌ Ghostscript não encontrado. Instale em https://ghostscript.com",
            "erro",
        )
        await pm.complete_task(task_id, "Ghostscript não instalado.")
        return

    total = len(arquivos)
    qual = req.qualidade.value
    ok = err = 0

    for i, arq in enumerate(arquivos, 1):
        task = pm.get_task(task_id)
        if task and task.cancelada:
            break

        await pm.update_progress(task_id, i, total, f"[{i}/{total}] {arq.name}")
        dest_arq = _resolver_nome(req.pasta_destino, arq.name)

        cmd = [
            gs_cmd, "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4",
            f"-dPDFSETTINGS=/{qual}",
            "-dNOPAUSE", "-dQUIET", "-dBATCH",
            f"-sOutputFile={dest_arq}", str(arq),
        ]

        try:
            proc = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda c=cmd: subprocess.run(
                    c, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    timeout=600, creationflags=subprocess.CREATE_NO_WINDOW,
                ),
            )
            if proc.returncode == 0 and dest_arq.exists():
                antes = arq.stat().st_size
                depois = dest_arq.stat().st_size
                pct = int((1 - depois / antes) * 100) if antes else 0
                await pm.add_log(
                    task_id,
                    f"✅ {arq.name} {_fmt_bytes(antes)} → {_fmt_bytes(depois)} (-{pct}%)",
                    "ok",
                )
                ok += 1
            else:
                copia = _copiar_como_erro(arq, req.pasta_destino)
                nome_copia = copia.name if copia else "falha ao copiar"
                await pm.add_log(task_id, f"❌ Falha em {arq.name} → original salvo como '{nome_copia}'", "erro")
                err += 1
        except Exception as e:
            copia = _copiar_como_erro(arq, req.pasta_destino)
            nome_copia = copia.name if copia else "falha ao copiar"
            await pm.add_log(task_id, f"❌ {arq.name}: {e} → original salvo como '{nome_copia}'", "erro")
            err += 1

    msg = f"✅ {ok} PDF(s) comprimido(s)." + (f" ❌ {err} com erro (originais salvos com _ERRO)." if err else "")
    await pm.complete_task(task_id, msg)


# ── Endpoints ────────────────────────────────────────────────────
@router.post("/video", response_model=TaskResponse)
async def compress_video(req: CompressVideoRequest, bg: BackgroundTasks):
    task_id = progress_manager.create_task("compress_video")
    bg.add_task(_comprimir_video, req, task_id)
    return TaskResponse(task_id=task_id, message="Compressão de vídeo iniciada")


@router.post("/audio", response_model=TaskResponse)
async def compress_audio(req: CompressAudioRequest, bg: BackgroundTasks):
    task_id = progress_manager.create_task("compress_audio")
    bg.add_task(_comprimir_audio, req, task_id)
    return TaskResponse(task_id=task_id, message="Compressão de áudio iniciada")


@router.post("/image", response_model=TaskResponse)
async def compress_image(req: CompressImageRequest, bg: BackgroundTasks):
    task_id = progress_manager.create_task("compress_image")
    bg.add_task(_comprimir_imagem, req, task_id)
    return TaskResponse(task_id=task_id, message="Compressão de imagem iniciada")


@router.post("/pdf", response_model=TaskResponse)
async def compress_pdf(req: CompressPdfRequest, bg: BackgroundTasks):
    task_id = progress_manager.create_task("compress_pdf")
    bg.add_task(_comprimir_pdf, req, task_id)
    return TaskResponse(task_id=task_id, message="Compressão de PDF iniciada")


@router.post("/cancel/{task_id}")
async def cancel_compress(task_id: str):
    ok = progress_manager.cancel_task(task_id)
    return {"cancelado": ok}
