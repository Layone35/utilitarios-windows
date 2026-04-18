"""Router Duplicatas — Scanner de arquivos duplicados ou famílias por nome."""
import asyncio
import hashlib
import os
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel, Field

from app.models.schemas import TaskResponse
from app.services.progress import progress_manager

router = APIRouter(prefix="/api/duplicatas", tags=["duplicatas"])

_CHUNK = 65_536
_SUFIXOS = (
    "_assinado", "_signed", "_aprovado", "_final",
    "_v2", "_v1", "_copia", "_copy", "_backup",
)

# Armazena resultados de scans por task_id (em memória)
_resultados: dict[str, list[dict[str, Any]]] = {}


# ── Schemas locais ────────────────────────────────────────────────

class DuplicatasScanRequest(BaseModel):
    pasta: str
    recursivo: bool = Field(default=True)
    modo: str = Field(default="1", description="1=exatas, 2=familias, 3=ambos")


class DeletarArquivosRequest(BaseModel):
    caminhos: list[str]


# ── Helpers ───────────────────────────────────────────────────────

def _fmt_tamanho(n: int) -> str:
    for u in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {u}"
        n /= 1024
    return f"{n:.1f} TB"


def _fmt_data(ts: float) -> str:
    return datetime.fromtimestamp(ts).strftime("%d/%m/%Y %H:%M")


def _md5(caminho: Path) -> str:
    h = hashlib.md5()
    try:
        with open(caminho, "rb") as f:
            while chunk := f.read(_CHUNK):
                h.update(chunk)
    except (PermissionError, OSError):
        return ""
    return h.hexdigest()


def _listar_arquivos(pasta: Path, recursivo: bool) -> list[Path]:
    if recursivo:
        return [p for p in pasta.rglob("*") if p.is_file()]
    return [p for p in pasta.iterdir() if p.is_file()]


def _info_arquivo(arq: Path) -> dict[str, Any]:
    try:
        stat = arq.stat()
        tam = stat.st_size
        return {
            "caminho": str(arq),
            "nome": arq.name,
            "pasta": str(arq.parent),
            "tamanho": tam,
            "tamanho_fmt": _fmt_tamanho(tam),
            "data_mod": _fmt_data(stat.st_mtime),
        }
    except OSError:
        return {
            "caminho": str(arq),
            "nome": arq.name,
            "pasta": str(arq.parent),
            "tamanho": 0,
            "tamanho_fmt": "?",
            "data_mod": "?",
        }


# ── Lógica de scan ────────────────────────────────────────────────

async def _scan_exatas(arquivos: list[Path], task_id: str) -> list[dict[str, Any]]:
    pm = progress_manager
    grupos: list[dict[str, Any]] = []

    # 1ª passagem: agrupar por tamanho (evita hash de arquivos únicos)
    por_tamanho: dict[int, list[Path]] = defaultdict(list)
    for arq in arquivos:
        try:
            por_tamanho[arq.stat().st_size].append(arq)
        except OSError:
            pass

    candidatos = [lst for lst in por_tamanho.values() if len(lst) > 1]
    if not candidatos:
        await pm.add_log(task_id, "✅ Nenhuma duplicata exata encontrada.", "ok")
        return grupos

    # 2ª passagem: agrupar por MD5
    por_hash: dict[str, list[Path]] = defaultdict(list)
    total_c = sum(len(lst) for lst in candidatos)
    proc = 0

    loop = asyncio.get_running_loop()
    for grupo in candidatos:
        task = pm.get_task(task_id)
        if task and task.cancelada:
            break
        for arq in grupo:
            proc += 1
            await pm.update_progress(
                task_id, proc, total_c,
                f"MD5 {proc}/{total_c}: {arq.name}",
            )
            h = await loop.run_in_executor(None, _md5, arq)
            if h:
                por_hash[h].append(arq)

    for h, arqs in por_hash.items():
        if len(arqs) > 1:
            def _sz(p: Path) -> int:
                try:
                    return p.stat().st_size
                except OSError:
                    return 0
            tam_total = sum(_sz(a) for a in arqs)
            tam_recuperavel = sum(_sz(a) for a in arqs[1:])
            grupos.append({
                "tipo": "exata",
                "chave": h[:16],
                "arquivos": [_info_arquivo(a) for a in arqs],
                "tamanho_total": tam_total,
                "tamanho_total_fmt": _fmt_tamanho(tam_total),
                "espaco_recuperavel": tam_recuperavel,
                "espaco_recuperavel_fmt": _fmt_tamanho(tam_recuperavel),
            })

    await pm.add_log(task_id, f"🔍 Duplicatas exatas: {len(grupos)} grupo(s)", "info")
    return grupos


async def _scan_familias(arquivos: list[Path], task_id: str) -> list[dict[str, Any]]:
    pm = progress_manager
    grupos: list[dict[str, Any]] = []

    por_base: dict[tuple[str, str], list[Path]] = defaultdict(list)
    for arq in arquivos:
        stem = arq.stem
        base = stem
        for sep in _SUFIXOS:
            if stem.lower().endswith(sep):
                base = stem[: -len(sep)]
                break
        por_base[(str(arq.parent), base.lower())].append(arq)

    for (_pasta_str, base), arqs in por_base.items():
        if len(arqs) > 1:
            arqs_sorted = sorted(arqs, key=lambda p: p.suffix)
            def _safe_size(p: Path) -> int:
                try:
                    return p.stat().st_size
                except OSError:
                    return 0
            tam_total = sum(_safe_size(a) for a in arqs_sorted)
            grupos.append({
                "tipo": "familia",
                "chave": base,
                "arquivos": [_info_arquivo(a) for a in arqs_sorted],
                "tamanho_total": tam_total,
                "tamanho_total_fmt": _fmt_tamanho(tam_total),
                "espaco_recuperavel": 0,
                "espaco_recuperavel_fmt": "—",
            })

    await pm.add_log(task_id, f"🗂 Famílias por nome: {len(grupos)} grupo(s)", "info")
    return grupos


async def _executar_scan(req: DuplicatasScanRequest, task_id: str) -> None:
    pm = progress_manager
    pasta = Path(req.pasta)

    if not pasta.exists() or not pasta.is_dir():
        await pm.add_log(task_id, f"❌ Pasta não encontrada: {pasta}", "erro")
        await pm.complete_task(task_id, "Pasta inválida.")
        return

    await pm.add_log(task_id, f"📂 Escaneando: {pasta}", "info")
    arquivos = _listar_arquivos(pasta, req.recursivo)
    await pm.add_log(task_id, f"📄 {len(arquivos)} arquivo(s) encontrado(s)", "info")

    grupos: list[dict[str, Any]] = []

    if req.modo in ("1", "3"):
        await pm.add_log(task_id, "🔍 Buscando duplicatas exatas (MD5)...", "info")
        grupos += await _scan_exatas(arquivos, task_id)

    task = pm.get_task(task_id)
    if task and task.cancelada:
        await pm.complete_task(task_id, "Cancelado pelo usuário.")
        return

    if req.modo in ("2", "3"):
        await pm.add_log(task_id, "🗂 Buscando famílias por nome...", "info")
        grupos += await _scan_familias(arquivos, task_id)

    _resultados[task_id] = grupos

    total_espaco = sum(g["espaco_recuperavel"] for g in grupos)
    msg = f"✅ {len(grupos)} grupo(s) encontrado(s) — {_fmt_tamanho(total_espaco)} recuperáveis"
    await pm.complete_task(task_id, msg)


# ── Endpoints ─────────────────────────────────────────────────────

@router.post("/scan", response_model=TaskResponse)
async def scan_duplicatas(req: DuplicatasScanRequest, bg: BackgroundTasks):
    task_id = progress_manager.create_task("duplicatas_scan")
    bg.add_task(_executar_scan, req, task_id)
    return TaskResponse(task_id=task_id, message="Scan iniciado.")


@router.get("/resultado/{task_id}")
async def get_resultado(task_id: str):
    grupos = _resultados.get(task_id, [])
    total_espaco = sum(g["espaco_recuperavel"] for g in grupos)
    return {
        "grupos": grupos,
        "total_grupos": len(grupos),
        "espaco_recuperavel": total_espaco,
        "espaco_recuperavel_fmt": _fmt_tamanho(total_espaco) if total_espaco else "0 B",
    }


@router.post("/deletar")
async def deletar_arquivos(req: DeletarArquivosRequest):
    deletados: list[str] = []
    erros: list[str] = []
    bytes_liberados = 0

    for caminho_str in req.caminhos:
        arq = Path(caminho_str)
        try:
            tam = arq.stat().st_size
            arq.unlink()
            deletados.append(caminho_str)
            bytes_liberados += tam
        except Exception as e:
            erros.append(f"{arq.name}: {e}")

    return {
        "deletados": len(deletados),
        "erros": erros,
        "bytes_liberados": bytes_liberados,
        "bytes_liberados_fmt": _fmt_tamanho(bytes_liberados),
    }


@router.post("/cancel/{task_id}")
async def cancel_scan(task_id: str):
    ok = progress_manager.cancel_task(task_id)
    return {"cancelado": ok}
