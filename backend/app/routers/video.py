"""Router de conversão de vídeo — TS→MP4 e Vídeo→Vídeo."""
import os
import asyncio
import subprocess
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks

from app.models.schemas import ConvertVideoRequest, TaskResponse
from app.services.progress import progress_manager

router = APIRouter(prefix="/api/video", tags=["video"])

_EXT_VIDEO = {
    ".mp4", ".mkv", ".avi", ".mov", ".m4v", ".wmv",
    ".flv", ".webm", ".ts", ".m2ts", ".mts", ".3gp", ".vob",
}


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
    """Gera nome único se já existir."""
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


def _run_ffmpeg(cmd: list[str], task_id: str, timeout: int) -> int:
    """Executa ffmpeg via Popen, registra proc para cancelamento/shutdown."""
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    progress_manager.set_proc(task_id, proc)
    try:
        proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()
    finally:
        progress_manager.clear_proc(task_id)
    return proc.returncode if proc.returncode is not None else -1


async def _converter_videos(req: ConvertVideoRequest, task_id: str) -> None:
    """Executa conversão de vídeos em background."""
    pm = progress_manager
    orig = req.pasta_origem
    dest = req.pasta_destino
    os.makedirs(dest, exist_ok=True)

    # Listar arquivos
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

    ok = err = 0
    for i, arq in enumerate(arquivos, 1):
        task = pm.get_task(task_id)
        if task and task.cancelada:
            await pm.add_log(task_id, "⏹ Conversão cancelada pelo usuário.", "warn")
            break

        await pm.update_progress(task_id, i, total, f"[{i}/{total}] {arq.name}")

        formato = "mp4" if req.modo_ts else req.formato.value
        dest_arq = _resolver_nome(dest, arq.stem + f".{formato}")

        # Montar comando FFmpeg
        if req.codec.value == "copy" or (req.modo_ts and req.codec.value == "copy"):
            cmd = ["ffmpeg", "-y", "-i", str(arq), "-c", "copy", str(dest_arq)]
        elif req.codec.value == "h265":
            cmd = [
                "ffmpeg", "-y", "-i", str(arq),
                "-c:v", "libx265", "-crf", str(req.crf),
                "-preset", req.preset.value,
                "-c:a", "aac", "-b:a", "192k",
                str(dest_arq),
            ]
        else:  # h264
            cmd = [
                "ffmpeg", "-y", "-i", str(arq),
                "-c:v", "libx264", "-crf", str(req.crf),
                "-preset", req.preset.value,
                "-c:a", "aac", "-b:a", "192k",
                str(dest_arq),
            ]

        try:
            returncode = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda c=cmd: _run_ffmpeg(c, task_id, 7200),
            )
            # Verifica se foi cancelado durante a execução
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
    """Inicia conversão de vídeo(s) em background."""
    task_id = progress_manager.create_task("video_convert")
    bg.add_task(_converter_videos, req, task_id)
    return TaskResponse(task_id=task_id, message="Conversão iniciada")


@router.post("/cancel/{task_id}")
async def cancel_video(task_id: str):
    """Cancela uma tarefa em andamento."""
    ok = progress_manager.cancel_task(task_id)
    return {"cancelado": ok}
