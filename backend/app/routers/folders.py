"""Router de manipulação de pastas e extração de ZIPs/RARs."""
import os
import asyncio
import zipfile
import shutil
import subprocess
from pathlib import Path

# Localiza o executável 7z (PATH ou instalação padrão do Windows)
def _find_7z() -> str:
    import shutil as _shutil
    exe = _shutil.which("7z") or _shutil.which("7z.exe")
    if exe:
        return exe
    for candidate in [
        r"C:\Program Files\7-Zip\7z.exe",
        r"C:\Program Files (x86)\7-Zip\7z.exe",
    ]:
        if os.path.isfile(candidate):
            return candidate
    return "7z"  # fallback, vai falhar com mensagem clara

_7Z = _find_7z()

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

router = APIRouter(prefix="/api/folders", tags=["folders"])

_EXT_ARCHIVE = {".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".tar.gz", ".tgz"}

# Caracteres inválidos em nomes de arquivo no Windows
_CHARS_INVALIDOS = str.maketrans({c: "_" for c in r'\/:*?"<>|'})


def _sanitizar_nome(nome: str) -> str:
    """Remove/substitui caracteres inválidos para nomes de arquivo no Windows."""
    return nome.translate(_CHARS_INVALIDOS).strip()


def _truncar_nome(nome: str, pasta_dest: Path, sufixo: str, limite: int = 250) -> str:
    """Trunca o nome do arquivo se o caminho final ultrapassar o limite de caracteres."""
    caminho_base = len(str(pasta_dest)) + 1  # +1 pelo separador
    disponivel = limite - caminho_base - len(sufixo)
    stem = Path(nome).stem
    if len(stem) > disponivel:
        stem = stem[:max(disponivel, 10)]  # mínimo 10 chars
    return stem + sufixo


def _scan(pasta: str, exts: set[str] | None, subpastas: bool) -> list[Path]:
    orig = Path(pasta)
    if subpastas:
        candidatos = (Path(r) / f for r, _, fs in os.walk(pasta) for f in fs)
    else:
        candidatos = (orig / f for f in os.listdir(pasta) if (orig / f).is_file())
    if exts:
        return sorted(p for p in candidatos if p.suffix.lower() in exts)
    return sorted(candidatos)


def _fmt_bytes(n: int) -> str:
    for u in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {u}"
        n /= 1024
    return f"{n:.1f} TB"


async def _extrair_arquivos(req: ExtractArchiveRequest, task_id: str) -> None:
    pm = progress_manager
    orig = req.pasta_origem
    dest = req.pasta_destino
    os.makedirs(dest, exist_ok=True)

    # Encontrar arquivos compactados (pula apenas partes RAR clássicas: .r00, .r01, ...)
    _ext_archive_filtrada = _EXT_ARCHIVE - {".r00", ".r01", ".r02", ".r03", ".r04",
                                             ".r05", ".r06", ".r07", ".r08", ".r09"}
    arquivos = _scan(orig, _ext_archive_filtrada, req.incluir_subpastas)

    if not arquivos:
        await pm.add_log(task_id, "ℹ️ Nenhum arquivo compactado encontrado.", "warn")
        await pm.complete_task(task_id, "Nenhum arquivo encontrado.")
        return

    total = len(arquivos)
    await pm.add_log(task_id, f"📦 {total} arquivo(s) compactado(s) encontrado(s)", "info")

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
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda a=arq, p=pasta_extrair: _extrair_zip(a, p),
                )
            elif ext in (".tar", ".gz", ".bz2", ".xz", ".tgz"):
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda a=arq, p=pasta_extrair: shutil.unpack_archive(str(a), str(p)),
                )
            elif ext == ".rar":
                # Usa 7z para extrair RAR (suporta multi-volume automaticamente)
                os.makedirs(pasta_extrair, exist_ok=True)
                await asyncio.get_event_loop().run_in_executor(
                    None,
                    lambda a=arq, p=pasta_extrair: subprocess.run(
                        [_7Z, "x", str(a), f"-o{p}", "-y"],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        timeout=600,
                        creationflags=subprocess.CREATE_NO_WINDOW,
                    ),
                )
            elif ext == ".7z":
                await asyncio.get_event_loop().run_in_executor(
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
    orig = req.pasta_origem
    dest = req.pasta_destino
    os.makedirs(dest, exist_ok=True)

    # Filtro de extensões
    exts: set[str] | None = None
    if req.extensoes:
        exts = {e.lower() if e.startswith(".") else f".{e.lower()}" for e in req.extensoes}

    # Coletar todos os arquivos recursivamente (ignora a raiz direta se for a mesma que destino)
    arquivos: list[Path] = []
    for r, _, fs in os.walk(orig):
        for f in fs:
            caminho = Path(r) / f
            if exts and caminho.suffix.lower() not in exts:
                continue
            arquivos.append(caminho)

    # Ordenar pelo caminho relativo completo para respeitar a hierarquia das pastas
    arquivos.sort(key=lambda p: str(p.relative_to(orig)).lower())

    if not arquivos:
        await pm.add_log(task_id, "ℹ️ Nenhum arquivo encontrado.", "warn")
        await pm.complete_task(task_id, "Nenhum arquivo encontrado.")
        return

    total = len(arquivos)
    acao = "movido" if req.mover else "copiado"
    modo = "preservando ordem" if req.preservar_ordem else "sem prefixo"
    await pm.add_log(
        task_id,
        f"📁 {total} arquivo(s) para {'mover' if req.mover else 'copiar'} ({modo})",
        "info",
    )

    ok = err = 0
    for i, arq in enumerate(arquivos, 1):
        task = pm.get_task(task_id)
        if task and task.cancelada:
            break

        await pm.update_progress(task_id, i, total, f"[{i}/{total}] {arq.name}")

        # Gerar nome de destino (com prefixo de pasta se preservar_ordem=True)
        if req.preservar_ordem:
            rel = arq.parent.relative_to(orig)
            partes = [p for p in rel.parts if p]
            if partes:
                # Sanitizar cada parte: remove caracteres inválidos no Windows
                partes_safe = [_sanitizar_nome(p) for p in partes]
                prefixo = " - ".join(partes_safe)
                nome_base = f"{prefixo} - {arq.name}"
            else:
                nome_base = arq.name
        else:
            nome_base = arq.name

        # Truncar se o caminho final ultrapassar 240 chars (margem segura)
        nome_dest = _truncar_nome(nome_base, Path(dest), arq.suffix)

        # Resolver conflito de nome
        destino_final = Path(dest) / nome_dest
        contador = 2
        while destino_final.exists():
            stem = Path(nome_dest).stem
            destino_final = Path(dest) / f"{stem}_{contador}{arq.suffix}"
            contador += 1

        try:
            if req.mover:
                await asyncio.get_event_loop().run_in_executor(
                    None, lambda s=arq, d=destino_final: shutil.move(str(s), str(d))
                )
            else:
                await asyncio.get_event_loop().run_in_executor(
                    None, lambda s=arq, d=destino_final: shutil.copy2(str(s), str(d))
                )
            tamanho = destino_final.stat().st_size
            nome_exibir = destino_final.name
            await pm.add_log(
                task_id,
                f"✅ {arq.name} → {nome_exibir} ({_fmt_bytes(tamanho)}) {acao}",
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
            arquivos.append(FileInfo(
                nome=f,
                tamanho=tamanho,
                caminho=str(caminho),
            ))

    arquivos.sort(key=lambda x: x.nome.lower())
    return ListFilesResponse(arquivos=arquivos, total=len(arquivos))


@router.post("/cancel/{task_id}")
async def cancel_folder(task_id: str):
    ok = progress_manager.cancel_task(task_id)
    return {"cancelado": ok}
