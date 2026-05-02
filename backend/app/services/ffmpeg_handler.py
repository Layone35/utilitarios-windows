"""Wrappers compartilhados para chamadas FFmpeg com suporte a cancelamento."""
import asyncio
import subprocess
import threading
import time

from app.services.progress import progress_manager


def run_ffmpeg(cmd: list[str], task_id: str, timeout: int) -> int:
    """Executa FFmpeg via Popen registrando o processo para cancelamento."""
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


def run_ffmpeg_with_progress(cmd: list[str], task_id: str, timeout: int, loop) -> int:
    """Executa FFmpeg com leitura de progresso em tempo real via thread."""
    prog_cmd = cmd[:-1] + ["-progress", "pipe:1", "-nostats", cmd[-1]]

    proc = subprocess.Popen(
        prog_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW,
        text=True,
        bufsize=1,
    )
    progress_manager.set_proc(task_id, proc)

    stop_event = threading.Event()
    last_log: list[float] = [0.0]

    def _reader() -> None:
        data: dict[str, str] = {}
        try:
            for line in proc.stdout:  # type: ignore[union-attr]
                if stop_event.is_set():
                    break
                key, _, val = line.strip().partition("=")
                if not key:
                    continue
                data[key] = val.strip()
                if key == "progress" and loop:
                    now = time.monotonic()
                    if now - last_log[0] >= 4:
                        last_log[0] = now
                        out_time = data.get("out_time", "").split(".")[0]
                        speed = data.get("speed", "N/A")
                        size_raw = data.get("total_size", "0")
                        try:
                            size_str = f"{int(size_raw) / 1_048_576:.1f} MB"
                        except ValueError:
                            size_str = ""
                        partes = []
                        if out_time:
                            partes.append(f"⏱ {out_time}")
                        if speed not in ("", "N/A"):
                            partes.append(speed)
                        if size_str:
                            partes.append(f"→ {size_str}")
                        if partes:
                            asyncio.run_coroutine_threadsafe(
                                progress_manager.add_log(task_id, "   " + " | ".join(partes), "info"),
                                loop,
                            )
                    data = {}
        except Exception:
            pass
        finally:
            try:
                proc.stdout.close()  # type: ignore[union-attr]
            except Exception:
                pass

    t = threading.Thread(target=_reader, daemon=True)
    t.start()

    try:
        proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()
    finally:
        stop_event.set()
        progress_manager.clear_proc(task_id)

    t.join(timeout=5)
    if t.is_alive():
        try:
            proc.stdout.close()  # type: ignore[union-attr]
        except Exception:
            pass
        t.join(timeout=2)

    return proc.returncode if proc.returncode is not None else -1
