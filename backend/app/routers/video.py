"""Router de conversão de vídeo — TS→MP4 e Vídeo→Vídeo."""
import asyncio
import os
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks

from app.models.schemas import ConvertVideoRequest, TaskResponse
from app.services.ffmpeg_handler import run_ffmpeg_with_progress
from app.services.progress import progress_manager
from app.utils import _fmt_bytes, _scan, _resolver_nome

router = APIRouter(prefix="/api/video", tags=["video"])

_EXT_VIDEO = {
    ".mp4", ".mkv", ".avi", ".mov", ".m4v", ".wmv",
    ".flv", ".webm", ".ts", ".m2ts", ".mts", ".3gp", ".vob",
}



async def _converter_videos(req: ConvertVideoRequest, task_id: str) -> None:
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

    if req.modo_ts:
        arquivos = _scan(orig, {".ts"}, req.incluir_subpastas)
    else:
        arquivos = _scan(orig, _EXT_VIDEO, req.incluir_subpastas)

    if not arquivos:
        await pm.add_log(task_id, "ℹ️ Nenhum vídeo encontrado na pasta.", "warn")
        await pm.complete_task(task_id, "Nenhum vídeo encontrado.")
        return

    total = len(arquivos)
    await pm.add_log(task_id, f"📊 {total} arquivo(s) encontrado(s)", "info")

    loop = asyncio.get_running_loop()
    ok = err = 0

    for i, arq in enumerate(arquivos, 1):
        task = pm.get_task(task_id)
        if task and task.cancelada:
            await pm.add_log(task_id, "⏹ Conversão cancelada pelo usuário.", "warn")
            break

        await pm.update_progress(task_id, i, total, f"[{i}/{total}] {arq.name}")
        await pm.add_log(task_id, f"🎬 [{i}/{total}] Processando: {arq.name}", "info")

        formato = "mp4" if req.modo_ts else req.formato.value

        # Preserva estrutura de subpastas com resolve() para evitar mismatch de separadores
        try:
            relative_dir = arq.parent.resolve().relative_to(Path(orig).resolve())
        except ValueError:
            relative_dir = Path()
        dest_subdir = Path(dest) / relative_dir
        os.makedirs(dest_subdir, exist_ok=True)
        dest_arq = _resolver_nome(str(dest_subdir), arq.stem + f".{formato}")

        if req.codec.value == "copy":
            cmd = ["ffmpeg", "-y", "-i", str(arq), "-c", "copy", str(dest_arq)]
        elif req.codec.value == "h265":
            cmd = [
                "ffmpeg", "-y", "-i", str(arq),
                "-c:v", "libx265", "-crf", str(req.crf),
                "-preset", req.preset.value,
                "-c:a", "aac", "-b:a", "192k",
                str(dest_arq),
            ]
        else:
            cmd = [
                "ffmpeg", "-y", "-i", str(arq),
                "-c:v", "libx264", "-crf", str(req.crf),
                "-preset", req.preset.value,
                "-c:a", "aac", "-b:a", "192k",
                str(dest_arq),
            ]

        try:
            returncode = await loop.run_in_executor(
                None,
                lambda c=cmd: run_ffmpeg_with_progress(c, task_id, 7200, loop),
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


@router.post("/convert", response_model=TaskResponse)
async def convert_video(req: ConvertVideoRequest, bg: BackgroundTasks):
    task_id = progress_manager.create_task("video_convert")
    bg.add_task(_converter_videos, req, task_id)
    return TaskResponse(task_id=task_id, message="Conversão iniciada")


@router.post("/cancel/{task_id}")
async def cancel_video(task_id: str):
    ok = progress_manager.cancel_task(task_id)
    return {"cancelado": ok}
