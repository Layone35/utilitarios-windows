"""Router de manipulação de pastas e extração de ZIPs/RARs."""
import asyncio
import os
import shutil
import subprocess
import zipfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks

from app.models.schemas import (
    ExtractArchiveRequest,
    FlattenFolderRequest,
    ListFilesRequest,
    ListFilesResponse,
    FileInfo,
    TaskResponse,
)
from app.services.progress import progress_manager
from app.utils import _fmt_bytes, _scan


def _find_7z() -> str:
    exe = shutil.which("7z") or shutil.which("7z.exe")
    if exe:
        return exe
    for candidate in [
        r"C:\Program Files\7-Zip\7z.exe",
        r"C:\Program Files (x86)\7-Zip\7z.exe",
    ]:
        if os.path.isfile(candidate):
            return candidate
    return "7z"

_7Z = _find_7z()

router = APIRouter(prefix="/api/folders", tags=["folders"])

_EXT_ARCHIVE = {".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".tar.gz", ".tgz"}

_CHARS_INVALIDOS = str.maketrans({c: "_" for c in r'\/:*?"<>|'})


def _sanitizar_nome(nome: str) -> str:
    return nome.translate(_CHARS_INVALIDOS).strip()


def _truncar_nome(nome: str, pasta_dest: Path, sufixo: str, limite: int = 250) -> str:
    caminho_base = len(str(pasta_dest)) + 1
    disponivel = limite - caminho_base - len(sufixo)
    stem = Path(nome).stem
    if len(stem) > disponivel:
        stem = stem[:max(disponivel, 10)]
    return stem + sufixo


def _resolver_nome_local(pasta: Path, nome: str) -> Path:
    """Resolve conflito de nome dentro de uma pasta."""
    destino = pasta / nome
    if not destino.exists():
        return destino
    stem = Path(nome).stem
    ext = Path(nome).suffix
    i = 2
    while True:
        novo = pasta / f"{stem}_{i}{ext}"
        if not novo.exists():
            return novo
        i += 1


async def _extrair_arquivos(req: ExtractArchiveRequest, task_id: str) -> None:
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

    _ext_filtrada = _EXT_ARCHIVE - {".r00", ".r01", ".r02", ".r03", ".r04",
                                      ".r05", ".r06", ".r07", ".r08", ".r09"}
    arquivos = _scan(orig, _ext_filtrada, req.incluir_subpastas)

    if not arquivos:
        await pm.add_log(task_id, "ℹ️ Nenhum arquivo compactado encontrado.", "warn")
        await pm.complete_task(task_id, "Nenhum arquivo encontrado.")
        return

    total = len(arquivos)
    await pm.add_log(task_id, f"📦 {total} arquivo(s) compactado(s) encontrado(s)", "info")

    loop = asyncio.get_running_loop()
    ok = err = 0

    for i, arq in enumerate(arquivos, 1):
        task = pm.get_task(task_id)
        if task and task.cancelada:
            break

        await pm.update_progress(task_id, i, total, f"[{i}/{total}] {arq.name}")
        pasta_extrair = Path(dest) / arq.stem

        try:
            ext = arq.suffix.lower()
            if ext == ".zip":
                await loop.run_in_executor(
                    None,
                    lambda a=arq, p=pasta_extrair: _extrair_zip(a, p),
                )
            elif ext in (".tar", ".gz", ".bz2", ".xz", ".tgz"):
                await loop.run_in_executor(
                    None,
                    lambda a=arq, p=pasta_extrair: shutil.unpack_archive(str(a), str(p)),
                )
            elif ext in (".rar", ".7z"):
                os.makedirs(pasta_extrair, exist_ok=True)
                await loop.run_in_executor(
                    None,
                    lambda a=arq, p=pasta_extrair: subprocess.run(
                        [_7Z, "x", str(a), f"-o{p}", "-y"],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        timeout=600,
                        creationflags=subprocess.CREATE_NO_WINDOW,
                    ),
                )
            else:
                shutil.unpack_archive(str(arq), str(pasta_extrair))

            tamanho = arq.stat().st_size
            await pm.add_log(
                task_id,
                f"✅ {arq.name} ({_fmt_bytes(tamanho)}) extraído para {pasta_extrair.name}/",
                "ok",
            )
            ok += 1
        except Exception as e:
            await pm.add_log(task_id, f"❌ {arq.name}: {e}", "erro")
            err += 1

    msg = f"✅ {ok} extraído(s)." + (f" ❌ {err} erro(s)." if err else "")
    await pm.complete_task(task_id, msg)


async def _flatten_folder(req: FlattenFolderRequest, task_id: str) -> None:
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

    exts: set[str] | None = None
    if req.extensoes:
        exts = {e.lower() if e.startswith(".") else f".{e.lower()}" for e in req.extensoes}

    arquivos: list[Path] = []
    for r, _, fs in os.walk(orig):
        for f in fs:
            caminho = Path(r) / f
            if exts and caminho.suffix.lower() not in exts:
                continue
            arquivos.append(caminho)

    arquivos.sort(key=lambda p: str(p.relative_to(orig)).lower())

    if not arquivos:
        await pm.add_log(task_id, "ℹ️ Nenhum arquivo encontrado.", "warn")
        await pm.complete_task(task_id, "Nenhum arquivo encontrado.")
        return

    total = len(arquivos)
    acao = "movido" if req.mover else "copiado"
    modo = "preservando ordem" if req.preservar_ordem else "sem prefixo"
    await pm.add_log(task_id, f"📁 {total} arquivo(s) para {'mover' if req.mover else 'copiar'} ({modo})", "info")

    loop = asyncio.get_running_loop()
    ok = err = 0

    for i, arq in enumerate(arquivos, 1):
        task = pm.get_task(task_id)
        if task and task.cancelada:
            break

        await pm.update_progress(task_id, i, total, f"[{i}/{total}] {arq.name}")

        if req.preservar_ordem:
            rel = arq.parent.relative_to(orig)
            partes = [p for p in rel.parts if p]
            if partes:
                partes_safe = [_sanitizar_nome(p) for p in partes]
                nome_base = f"{' - '.join(partes_safe)} - {arq.name}"
            else:
                nome_base = arq.name
        else:
            nome_base = arq.name

        nome_dest = _truncar_nome(nome_base, Path(dest), arq.suffix)
        destino_final = _resolver_nome_local(Path(dest), nome_dest)

        try:
            if req.mover:
                await loop.run_in_executor(
                    None, lambda s=arq, d=destino_final: shutil.move(str(s), str(d))
                )
            else:
                await loop.run_in_executor(
                    None, lambda s=arq, d=destino_final: shutil.copy2(str(s), str(d))
                )
            tamanho = destino_final.stat().st_size
            await pm.add_log(
                task_id,
                f"✅ {arq.name} → {destino_final.name} ({_fmt_bytes(tamanho)}) {acao}",
                "ok",
            )
            ok += 1
        except Exception as e:
            await pm.add_log(task_id, f"❌ {arq.name}: {e}", "erro")
            err += 1

    msg = f"✅ {ok} arquivo(s) {acao}(s)." + (f" ❌ {err} erro(s)." if err else "")
    await pm.complete_task(task_id, msg)


def _extrair_zip(arq: Path, destino: Path) -> None:
    os.makedirs(destino, exist_ok=True)
    with zipfile.ZipFile(str(arq), "r") as zf:
        zf.extractall(str(destino))


@router.post("/extract", response_model=TaskResponse)
async def extract_archives(req: ExtractArchiveRequest, bg: BackgroundTasks):
    task_id = progress_manager.create_task("folder_extract")
    bg.add_task(_extrair_arquivos, req, task_id)
    return TaskResponse(task_id=task_id, message="Extração iniciada")


@router.post("/flatten", response_model=TaskResponse)
async def flatten_folder(req: FlattenFolderRequest, bg: BackgroundTasks):
    task_id = progress_manager.create_task("folder_flatten")
    bg.add_task(_flatten_folder, req, task_id)
    return TaskResponse(task_id=task_id, message="Achatamento de pastas iniciado")


@router.post("/list", response_model=ListFilesResponse)
async def list_files(req: ListFilesRequest):
    pasta = req.pasta
    if not os.path.isdir(pasta):
        return ListFilesResponse(arquivos=[], total=0)

    arquivos: list[FileInfo] = []
    exts = {e.lower() if e.startswith(".") else f".{e.lower()}" for e in (req.extensoes or [])}

    for r, _, fs in os.walk(pasta):
        for f in fs:
            caminho = Path(r) / f
            if exts and caminho.suffix.lower() not in exts:
                continue
            try:
                tamanho = caminho.stat().st_size
            except OSError:
                tamanho = 0
            arquivos.append(FileInfo(nome=f, tamanho=tamanho, caminho=str(caminho)))

    arquivos.sort(key=lambda x: x.nome.lower())
    return ListFilesResponse(arquivos=arquivos, total=len(arquivos))


@router.post("/cancel/{task_id}")
async def cancel_folder(task_id: str):
    ok = progress_manager.cancel_task(task_id)
    return {"cancelado": ok}
