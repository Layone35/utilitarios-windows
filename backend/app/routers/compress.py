"""Router de compressão — vídeo, áudio, imagem e PDF."""
import os
import asyncio
import shutil
import subprocess
import time
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
from app.utils import _fmt_bytes, _fmt_tempo, _scan, _resolver_nome

router = APIRouter(prefix="/api/compress", tags=["compress"])

_EXT_VIDEO = {".mp4", ".mkv", ".avi", ".mov", ".m4v", ".wmv", ".flv", ".webm"}
_EXT_AUDIO = {".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".wma"}
_EXT_IMG   = {".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".webp", ".gif", ".heic", ".heif"}

# Encoder, quality flag template (use .format(crf=N)), extra flags
_GPU_CODEC: dict[tuple[str, str], tuple[str, str, str]] = {
    ("h264", "nvenc"): ("h264_nvenc", "-cq {crf}", "-preset p2"),
    ("h265", "nvenc"): ("hevc_nvenc", "-cq {crf}", "-preset p2"),
    ("h264", "amf"):   ("h264_amf",   "-qp {crf}", ""),
    ("h265", "amf"):   ("hevc_amf",   "-qp {crf}", ""),
    ("h264", "qsv"):   ("h264_qsv",   "-q {crf}",  ""),
    ("h265", "qsv"):   ("hevc_qsv",   "-q {crf}",  ""),
}


# ── Helpers ──────────────────────────────────────────────────────────

def _dest_pasta(pasta_origem: str, pasta_destino: str, arq: Path) -> Path:
    try:
        orig = Path(pasta_origem).resolve()
        parent = arq.parent.resolve()
        rel = parent.relative_to(orig)
        pasta = Path(pasta_destino) / rel
    except ValueError:
        pasta = Path(pasta_destino)
    pasta.mkdir(parents=True, exist_ok=True)
    return pasta


def _copiar_como_erro(origem: Path, pasta_destino: str, pasta_origem: str | None = None) -> Path | None:
    try:
        if pasta_origem:
            dest_pasta = _dest_pasta(pasta_origem, pasta_destino, origem)
        else:
            dest_pasta = Path(pasta_destino)
        dest = _resolver_nome(str(dest_pasta), f"{origem.stem}_ERRO{origem.suffix}")
        shutil.copy2(str(origem), str(dest))
        return dest
    except Exception:
        return None


def _destino_dentro_origem(pasta_origem: str, pasta_destino: str) -> bool:
    try:
        Path(pasta_destino).resolve().relative_to(Path(pasta_origem).resolve())
        return True
    except ValueError:
        return False


def _get_img_ext(arq: Path, fmt: str) -> tuple[str, str]:
    """Retorna (extensão_saída, formato_PIL)."""
    if fmt == "original":
        ext = arq.suffix.lower()
        if ext in (".jpg", ".jpeg"):
            return ".jpg", "JPEG"
        if ext == ".webp":
            return ".webp", "WEBP"
        if ext == ".png":
            return ".png", "PNG"
        return ".jpg", "JPEG"
    if fmt == "jpeg":
        return ".jpg", "JPEG"
    if fmt == "webp":
        return ".webp", "WEBP"
    return ".png", "PNG"


async def _validar_pastas(
    pasta_origem: str, pasta_destino: str,
    task_id: str, pm, incluir_subpastas: bool = False,
) -> bool:
    if not pasta_origem.strip() or not pasta_destino.strip():
        await pm.add_log(task_id, "❌ Pasta de origem e destino são obrigatórias.", "erro")
        await pm.complete_task(task_id, "Caminhos inválidos.")
        return False
    if not Path(pasta_origem).exists():
        await pm.add_log(task_id, f"❌ Pasta de origem não encontrada: {pasta_origem}", "erro")
        await pm.complete_task(task_id, "Pasta de origem não encontrada.")
        return False
    if incluir_subpastas and _destino_dentro_origem(pasta_origem, pasta_destino):
        await pm.add_log(
            task_id,
            "⚠️ Destino está dentro da origem — arquivos já comprimidos serão reprocessados em execuções futuras se você rodar novamente.",
            "warn",
        )
    return True


# ── Compressão de Vídeo ──────────────────────────────────────────
async def _comprimir_video(req: CompressVideoRequest, task_id: str) -> None:
    pm = progress_manager
    if not await _validar_pastas(req.pasta_origem, req.pasta_destino, task_id, pm, req.incluir_subpastas):
        return
    os.makedirs(req.pasta_destino, exist_ok=True)

    arquivos = _scan(req.pasta_origem, _EXT_VIDEO, req.incluir_subpastas)
    if not arquivos:
        await pm.add_log(task_id, "ℹ️ Nenhum vídeo encontrado.", "warn")
        await pm.complete_task(task_id, "Nenhum vídeo encontrado.")
        return

    total = len(arquivos)
    h265 = req.codec.value == "h265"
    tipo_codec = "h265" if h265 else "h264"
    gpu_key = (tipo_codec, req.gpu.value)

    ok = err = pulados = 0
    task_inicio = time.monotonic()
    tempos: list[float] = []
    loop = asyncio.get_running_loop()

    for i, arq in enumerate(arquivos, 1):
        task = pm.get_task(task_id)
        if task and task.cancelada:
            break

        total_elapsed = time.monotonic() - task_inicio
        avg = (sum(tempos) / len(tempos)) if tempos else None
        eta_seg = (avg * (total - i + 1)) if avg else None
        await pm.update_progress(task_id, i, total, f"[{i}/{total}] {arq.name}",
                                  elapsed=total_elapsed, eta=eta_seg)

        dest_pasta = _dest_pasta(req.pasta_origem, req.pasta_destino, arq)
        dest_base = dest_pasta / (arq.stem + ".mp4")

        if req.pular_existentes and dest_base.exists():
            await pm.add_log(task_id, f"⏭ {arq.name} — já existe no destino, pulado", "warn")
            pulados += 1
            continue

        dest_arq = _resolver_nome(str(dest_pasta), arq.stem + ".mp4")
        vf = f"scale=-2:{req.resolucao.value}" if req.resolucao.value != "original" else None

        if req.gpu.value != "cpu" and gpu_key in _GPU_CODEC:
            enc, quality_tpl, extra = _GPU_CODEC[gpu_key]
            quality_flag = quality_tpl.format(crf=req.crf)
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

        file_inicio = time.monotonic()
        try:
            proc = await loop.run_in_executor(
                None,
                lambda c=cmd: subprocess.run(
                    c, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    timeout=3600, creationflags=subprocess.CREATE_NO_WINDOW,
                ),
            )
            file_elapsed = time.monotonic() - file_inicio
            tempos.append(file_elapsed)

            if proc.returncode == 0 and dest_arq.exists():
                antes = arq.stat().st_size
                depois = dest_arq.stat().st_size
                pct = int((1 - depois / antes) * 100) if antes else 0
                taxa = antes / file_elapsed / 1024 / 1024 if file_elapsed > 0 else 0
                await pm.add_log(
                    task_id,
                    f"✅ {arq.name} {_fmt_bytes(antes)} → {_fmt_bytes(depois)} (-{pct}%) | ⏱ {_fmt_tempo(file_elapsed)} | {taxa:.1f} MB/s",
                    "ok",
                )
                ok += 1
            else:
                copia = _copiar_como_erro(arq, req.pasta_destino, req.pasta_origem)
                nome_copia = copia.name if copia else "falha ao copiar"
                await pm.add_log(task_id, f"❌ Erro em {arq.name} → original salvo como '{nome_copia}'", "erro")
                err += 1
        except Exception as e:
            tempos.append(time.monotonic() - file_inicio)
            copia = _copiar_como_erro(arq, req.pasta_destino, req.pasta_origem)
            nome_copia = copia.name if copia else "falha ao copiar"
            await pm.add_log(task_id, f"❌ {arq.name}: {e} → original salvo como '{nome_copia}'", "erro")
            err += 1

    total_tempo = time.monotonic() - task_inicio
    partes = [f"✅ {ok} vídeo(s) comprimido(s) em {_fmt_tempo(total_tempo)}."]
    if pulados:
        partes.append(f"⏭ {pulados} pulado(s).")
    if err:
        partes.append(f"❌ {err} com erro (originais salvos com _ERRO).")
    await pm.complete_task(task_id, " ".join(partes))


# ── Compressão de Áudio ──────────────────────────────────────────
async def _comprimir_audio(req: CompressAudioRequest, task_id: str) -> None:
    pm = progress_manager
    if not await _validar_pastas(req.pasta_origem, req.pasta_destino, task_id, pm, req.incluir_subpastas):
        return
    os.makedirs(req.pasta_destino, exist_ok=True)

    arquivos = _scan(req.pasta_origem, _EXT_AUDIO, req.incluir_subpastas)
    if not arquivos:
        await pm.add_log(task_id, "ℹ️ Nenhum áudio encontrado.", "warn")
        await pm.complete_task(task_id, "Nenhum áudio encontrado.")
        return

    total = len(arquivos)
    ok = err = pulados = 0
    task_inicio = time.monotonic()
    tempos: list[float] = []
    loop = asyncio.get_running_loop()

    for i, arq in enumerate(arquivos, 1):
        task = pm.get_task(task_id)
        if task and task.cancelada:
            break

        total_elapsed = time.monotonic() - task_inicio
        avg = (sum(tempos) / len(tempos)) if tempos else None
        eta_seg = (avg * (total - i + 1)) if avg else None
        await pm.update_progress(task_id, i, total, f"[{i}/{total}] {arq.name}",
                                  elapsed=total_elapsed, eta=eta_seg)

        dest_pasta = _dest_pasta(req.pasta_origem, req.pasta_destino, arq)
        dest_base = dest_pasta / (arq.stem + ".mp3")

        if req.pular_existentes and dest_base.exists():
            await pm.add_log(task_id, f"⏭ {arq.name} — já existe no destino, pulado", "warn")
            pulados += 1
            continue

        dest_arq = _resolver_nome(str(dest_pasta), arq.stem + ".mp3")
        cmd = [
            "ffmpeg", "-y", "-i", str(arq),
            "-b:a", req.bitrate.value, "-vn",
            str(dest_arq),
        ]

        file_inicio = time.monotonic()
        try:
            proc = await loop.run_in_executor(
                None,
                lambda c=cmd: subprocess.run(
                    c, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    timeout=600, creationflags=subprocess.CREATE_NO_WINDOW,
                ),
            )
            file_elapsed = time.monotonic() - file_inicio
            tempos.append(file_elapsed)

            if proc.returncode == 0 and dest_arq.exists():
                antes = arq.stat().st_size
                depois = dest_arq.stat().st_size
                pct = int((1 - depois / antes) * 100) if antes else 0
                await pm.add_log(
                    task_id,
                    f"✅ {arq.name} {_fmt_bytes(antes)} → {_fmt_bytes(depois)} (-{pct}%) | ⏱ {_fmt_tempo(file_elapsed)}",
                    "ok",
                )
                ok += 1
            else:
                copia = _copiar_como_erro(arq, req.pasta_destino, req.pasta_origem)
                nome_copia = copia.name if copia else "falha ao copiar"
                await pm.add_log(task_id, f"❌ Erro em {arq.name} → original salvo como '{nome_copia}'", "erro")
                err += 1
        except Exception as e:
            tempos.append(time.monotonic() - file_inicio)
            copia = _copiar_como_erro(arq, req.pasta_destino, req.pasta_origem)
            nome_copia = copia.name if copia else "falha ao copiar"
            await pm.add_log(task_id, f"❌ {arq.name}: {e} → original salvo como '{nome_copia}'", "erro")
            err += 1

    total_tempo = time.monotonic() - task_inicio
    partes = [f"✅ {ok} áudio(s) comprimido(s) em {_fmt_tempo(total_tempo)}."]
    if pulados:
        partes.append(f"⏭ {pulados} pulado(s).")
    if err:
        partes.append(f"❌ {err} com erro (originais salvos com _ERRO).")
    await pm.complete_task(task_id, " ".join(partes))


# ── Compressão de Imagem ─────────────────────────────────────────
async def _comprimir_imagem(req: CompressImageRequest, task_id: str) -> None:
    pm = progress_manager
    if not await _validar_pastas(req.pasta_origem, req.pasta_destino, task_id, pm, req.incluir_subpastas):
        return
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

    heic_count = sum(1 for a in arquivos if a.suffix.lower() in (".heic", ".heif"))
    if heic_count:
        await pm.add_log(
            task_id,
            f"⚠️ {heic_count} arquivo(s) HEIC/HEIF encontrado(s). Se houver erros, instale: pip install pillow-heif",
            "warn",
        )

    total = len(arquivos)
    ok = err = pulados = 0
    task_inicio = time.monotonic()
    tempos: list[float] = []
    loop = asyncio.get_running_loop()

    for i, arq in enumerate(arquivos, 1):
        task = pm.get_task(task_id)
        if task and task.cancelada:
            break

        total_elapsed = time.monotonic() - task_inicio
        avg = (sum(tempos) / len(tempos)) if tempos else None
        eta_seg = (avg * (total - i + 1)) if avg else None
        await pm.update_progress(task_id, i, total, f"[{i}/{total}] {arq.name}",
                                  elapsed=total_elapsed, eta=eta_seg)

        ext_out, pil_fmt = _get_img_ext(arq, req.formato.value)
        dest_pasta = _dest_pasta(req.pasta_origem, req.pasta_destino, arq)
        dest_base = dest_pasta / (arq.stem + ext_out)

        if req.pular_existentes and dest_base.exists():
            await pm.add_log(task_id, f"⏭ {arq.name} — já existe no destino, pulado", "warn")
            pulados += 1
            continue

        dest_arq = _resolver_nome(str(dest_pasta), arq.stem + ext_out)

        file_inicio = time.monotonic()
        try:
            qual = req.qualidade if pil_fmt != "PNG" else None

            def _process(arq=arq, dest_arq=dest_arq, ext_out=ext_out, pil_fmt=pil_fmt, qual=qual):
                img = Image.open(arq).convert("RGB")

                if req.escala.value != "original":
                    fator = int(req.escala.value) / 100
                    w = max(1, int(img.width * fator))
                    h = max(1, int(img.height * fator))
                    img = img.resize((w, h), Image.LANCZOS)

                save_kw = {} if pil_fmt == "PNG" else {"quality": qual, "optimize": True}
                img.save(str(dest_arq), pil_fmt, **save_kw)
                return dest_arq

            dest_arq = await loop.run_in_executor(None, _process)

            file_elapsed = time.monotonic() - file_inicio
            tempos.append(file_elapsed)
            antes = arq.stat().st_size
            depois = dest_arq.stat().st_size
            pct = int((1 - depois / antes) * 100) if antes else 0
            await pm.add_log(
                task_id,
                f"✅ {arq.name} {_fmt_bytes(antes)} → {_fmt_bytes(depois)} (-{pct}%) | ⏱ {_fmt_tempo(file_elapsed)}",
                "ok",
            )
            ok += 1
        except Exception as e:
            tempos.append(time.monotonic() - file_inicio)
            copia = _copiar_como_erro(arq, req.pasta_destino, req.pasta_origem)
            nome_copia = copia.name if copia else "falha ao copiar"
            await pm.add_log(task_id, f"❌ {arq.name}: {e} → original salvo como '{nome_copia}'", "erro")
            err += 1

    total_tempo = time.monotonic() - task_inicio
    partes = [f"✅ {ok} imagem(ns) comprimida(s) em {_fmt_tempo(total_tempo)}."]
    if pulados:
        partes.append(f"⏭ {pulados} pulada(s).")
    if err:
        partes.append(f"❌ {err} com erro (originais salvos com _ERRO).")
    await pm.complete_task(task_id, " ".join(partes))


# ── Compressão de PDF ────────────────────────────────────────────
async def _comprimir_pdf(req: CompressPdfRequest, task_id: str) -> None:
    pm = progress_manager
    if not await _validar_pastas(req.pasta_origem, req.pasta_destino, task_id, pm, req.incluir_subpastas):
        return
    os.makedirs(req.pasta_destino, exist_ok=True)

    arquivos = _scan(req.pasta_origem, {".pdf"}, req.incluir_subpastas)
    if not arquivos:
        await pm.add_log(task_id, "ℹ️ Nenhum PDF encontrado.", "warn")
        await pm.complete_task(task_id, "Nenhum PDF encontrado.")
        return

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
    ok = err = pulados = 0
    task_inicio = time.monotonic()
    tempos: list[float] = []
    loop = asyncio.get_running_loop()

    for i, arq in enumerate(arquivos, 1):
        task = pm.get_task(task_id)
        if task and task.cancelada:
            break

        total_elapsed = time.monotonic() - task_inicio
        avg = (sum(tempos) / len(tempos)) if tempos else None
        eta_seg = (avg * (total - i + 1)) if avg else None
        await pm.update_progress(task_id, i, total, f"[{i}/{total}] {arq.name}",
                                  elapsed=total_elapsed, eta=eta_seg)

        dest_pasta = _dest_pasta(req.pasta_origem, req.pasta_destino, arq)
        dest_base = dest_pasta / arq.name

        if req.pular_existentes and dest_base.exists():
            await pm.add_log(task_id, f"⏭ {arq.name} — já existe no destino, pulado", "warn")
            pulados += 1
            continue

        dest_arq = _resolver_nome(str(dest_pasta), arq.name)
        cmd = [
            gs_cmd, "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4",
            f"-dPDFSETTINGS=/{qual}",
            "-dNOPAUSE", "-dQUIET", "-dBATCH",
            f"-sOutputFile={dest_arq}", str(arq),
        ]

        file_inicio = time.monotonic()
        try:
            proc = await loop.run_in_executor(
                None,
                lambda c=cmd: subprocess.run(
                    c, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    timeout=600, creationflags=subprocess.CREATE_NO_WINDOW,
                ),
            )
            file_elapsed = time.monotonic() - file_inicio
            tempos.append(file_elapsed)

            if proc.returncode == 0 and dest_arq.exists():
                antes = arq.stat().st_size
                depois = dest_arq.stat().st_size
                pct = int((1 - depois / antes) * 100) if antes else 0
                await pm.add_log(
                    task_id,
                    f"✅ {arq.name} {_fmt_bytes(antes)} → {_fmt_bytes(depois)} (-{pct}%) | ⏱ {_fmt_tempo(file_elapsed)}",
                    "ok",
                )
                ok += 1
            else:
                copia = _copiar_como_erro(arq, req.pasta_destino, req.pasta_origem)
                nome_copia = copia.name if copia else "falha ao copiar"
                await pm.add_log(task_id, f"❌ Falha em {arq.name} → original salvo como '{nome_copia}'", "erro")
                err += 1
        except Exception as e:
            tempos.append(time.monotonic() - file_inicio)
            copia = _copiar_como_erro(arq, req.pasta_destino, req.pasta_origem)
            nome_copia = copia.name if copia else "falha ao copiar"
            await pm.add_log(task_id, f"❌ {arq.name}: {e} → original salvo como '{nome_copia}'", "erro")
            err += 1

    total_tempo = time.monotonic() - task_inicio
    partes = [f"✅ {ok} PDF(s) comprimido(s) em {_fmt_tempo(total_tempo)}."]
    if pulados:
        partes.append(f"⏭ {pulados} pulado(s).")
    if err:
        partes.append(f"❌ {err} com erro (originais salvos com _ERRO).")
    await pm.complete_task(task_id, " ".join(partes))


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
