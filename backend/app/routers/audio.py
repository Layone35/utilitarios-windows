"""Router de conversão de áudio — Vídeo→Áudio e Áudio→Áudio."""
import asyncio
import os
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks

from app.models.schemas import ExtractAudioRequest, ConvertAudioRequest, TaskResponse
from app.services.ffmpeg_handler import run_ffmpeg
from app.services.progress import progress_manager
from app.utils import _fmt_bytes, _scan, _resolver_nome

router = APIRouter(prefix="/api/audio", tags=["audio"])

_EXT_VIDEO = {
    ".mp4", ".mkv", ".avi", ".mov", ".m4v", ".wmv",
    ".flv", ".webm", ".ts", ".m2ts", ".mts", ".3gp", ".vob",
}

_EXT_AUDIO = {
    ".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a",
    ".wma", ".aiff", ".opus", ".ape", ".m4b", ".mpeg", ".mpga",
}

_CODEC_VA = {
    "mp3":  ["-vn", "-ar", "44100", "-ac", "2", "-b:a"],
    "aac":  ["-vn", "-c:a", "aac", "-b:a"],
    "wav":  ["-vn", "-c:a", "pcm_s16le"],
    "flac": ["-vn", "-c:a", "flac"],
    "ogg":  ["-vn", "-c:a", "libvorbis", "-b:a"],
    "m4a":  ["-vn", "-c:a", "aac", "-b:a"],
    "opus": ["-vn", "-c:a", "libopus", "-b:a"],
}

_CODEC_AA = {
    "mp3":  ["-c:a", "libmp3lame", "-b:a"],
    "aac":  ["-c:a", "aac", "-b:a"],
    "wav":  ["-c:a", "pcm_s16le"],
    "flac": ["-c:a", "flac"],
    "ogg":  ["-c:a", "libvorbis", "-b:a"],
    "m4a":  ["-c:a", "aac", "-b:a"],
    "opus": ["-c:a", "libopus", "-b:a"],
}



async def _extrair_audio(req: ExtractAudioRequest, task_id: str) -> None:
    pm = progress_manager

    if not req.pasta_origem.strip() or not req.pasta_destino.strip():
        await pm.add_log(task_id, "❌ Pasta de origem e destino são obrigatórias.", "erro")
        await pm.complete_task(task_id, "Caminhos inválidos.")
        return
    if not Path(req.pasta_origem).exists():
        await pm.add_log(task_id, f"❌ Pasta de origem não encontrada: {req.pasta_origem}", "erro")
        await pm.complete_task(task_id, "Pasta de origem não encontrada.")
        return

    orig = req.pasta_origem
    dest = req.pasta_destino
    os.makedirs(dest, exist_ok=True)

    videos = _scan(orig, _EXT_VIDEO, req.incluir_subpastas)

    if not videos:
        await pm.add_log(task_id, "ℹ️ Nenhum vídeo encontrado.", "warn")
        await pm.complete_task(task_id, "Nenhum vídeo encontrado.")
        return

    total = len(videos)
    fmt = req.formato.value
    br = req.bitrate.value
    await pm.add_log(task_id, f"▶ {total} vídeo(s) → .{fmt.upper()}", "info")

    codec_base = _CODEC_VA.get(fmt, ["-vn", "-ar", "44100", "-ac", "2", "-b:a"])
    codec_args = codec_base + [f"{br}k"] if "-b:a" in codec_base else codec_base[:]

    loop = asyncio.get_running_loop()
    ok = err = 0

    for i, video in enumerate(videos, 1):
        task = pm.get_task(task_id)
        if task and task.cancelada:
            break

        await pm.update_progress(task_id, i, total, f"[{i}/{total}] {video.name}")

        nome_saida = (video.stem + f".{fmt}") if req.manter_nome else f"audio_{i:03d}.{fmt}"
        dest_arq = _resolver_nome(dest, nome_saida)

        cmd = ["ffmpeg", "-y", "-i", str(video)] + codec_args + [str(dest_arq), "-loglevel", "quiet"]

        try:
            returncode = await loop.run_in_executor(
                None,
                lambda c=cmd: run_ffmpeg(c, task_id, 3600),
            )
            task = pm.get_task(task_id)
            if task and task.cancelada:
                break
            if returncode == 0 and dest_arq.exists():
                await pm.add_log(task_id, f"✅ {video.name} → {dest_arq.name}", "ok")
                ok += 1
            else:
                await pm.add_log(task_id, f"❌ Falha em {video.name}", "erro")
                err += 1
        except Exception as e:
            await pm.add_log(task_id, f"❌ {video.name}: {e}", "erro")
            err += 1

    msg = f"✅ {ok} convertido(s)." + (f" ❌ {err} erro(s)." if err else "")
    await pm.complete_task(task_id, msg)


async def _converter_audio(req: ConvertAudioRequest, task_id: str) -> None:
    pm = progress_manager

    if not req.pasta_origem.strip() or not req.pasta_destino.strip():
        await pm.add_log(task_id, "❌ Pasta de origem e destino são obrigatórias.", "erro")
        await pm.complete_task(task_id, "Caminhos inválidos.")
        return
    if not Path(req.pasta_origem).exists():
        await pm.add_log(task_id, f"❌ Pasta de origem não encontrada: {req.pasta_origem}", "erro")
        await pm.complete_task(task_id, "Pasta de origem não encontrada.")
        return

    orig = req.pasta_origem
    dest = req.pasta_destino
    os.makedirs(dest, exist_ok=True)

    audios = _scan(orig, _EXT_AUDIO, req.incluir_subpastas)

    if not audios:
        await pm.add_log(task_id, "ℹ️ Nenhum áudio encontrado.", "warn")
        await pm.complete_task(task_id, "Nenhum áudio encontrado.")
        return

    total = len(audios)
    fmt = req.formato.value
    br = req.bitrate.value
    await pm.add_log(task_id, f"▶ {total} áudio(s) → .{fmt.upper()}", "info")

    codec_base = _CODEC_AA.get(fmt, ["-c:a", "libmp3lame", "-b:a"])
    codec_args = codec_base + [f"{br}k"] if "-b:a" in codec_base else codec_base[:]

    loop = asyncio.get_running_loop()
    ok = err = 0

    for i, arq in enumerate(audios, 1):
        task = pm.get_task(task_id)
        if task and task.cancelada:
            break

        await pm.update_progress(task_id, i, total, f"[{i}/{total}] {arq.name}")
        dest_arq = _resolver_nome(dest, arq.stem + f".{fmt}")

        cmd = ["ffmpeg", "-y", "-i", str(arq)] + codec_args + [str(dest_arq), "-loglevel", "quiet"]

        try:
            returncode = await loop.run_in_executor(
                None,
                lambda c=cmd: run_ffmpeg(c, task_id, 3600),
            )
            task = pm.get_task(task_id)
            if task and task.cancelada:
                break
            if returncode == 0 and dest_arq.exists():
                antes = arq.stat().st_size
                depois = dest_arq.stat().st_size
                await pm.add_log(
                    task_id,
                    f"✅ {arq.name} → {dest_arq.name} ({_fmt_bytes(antes)} → {_fmt_bytes(depois)})",
                    "ok",
                )
                ok += 1
            else:
                await pm.add_log(task_id, f"❌ Falha em {arq.name}", "erro")
                err += 1
        except Exception as e:
            await pm.add_log(task_id, f"❌ {arq.name}: {e}", "erro")
            err += 1

    msg = f"✅ {ok} convertido(s)." + (f" ❌ {err} erro(s)." if err else "")
    await pm.complete_task(task_id, msg)


@router.post("/extract", response_model=TaskResponse)
async def extract_audio(req: ExtractAudioRequest, bg: BackgroundTasks):
    task_id = progress_manager.create_task("audio_extract")
    bg.add_task(_extrair_audio, req, task_id)
    return TaskResponse(task_id=task_id, message="Extração de áudio iniciada")


@router.post("/convert", response_model=TaskResponse)
async def convert_audio(req: ConvertAudioRequest, bg: BackgroundTasks):
    task_id = progress_manager.create_task("audio_convert")
    bg.add_task(_converter_audio, req, task_id)
    return TaskResponse(task_id=task_id, message="Conversão de áudio iniciada")


@router.post("/cancel/{task_id}")
async def cancel_audio(task_id: str):
    ok = progress_manager.cancel_task(task_id)
    return {"cancelado": ok}
