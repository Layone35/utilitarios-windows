"""Router para organizar arquivos em pastas por tipo ou por data."""
import os
import re
import shutil
import asyncio
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks

from app.models.schemas import OrganizeFolderRequest, OrganizePorDataRequest, TaskResponse
from app.services.progress import progress_manager
from app.utils import _fmt_bytes

router = APIRouter(prefix="/api/organize", tags=["organize"])

# Mapeamento extensão → nome da pasta
_CATEGORIAS: dict[str, str] = {
    # Vídeo
    ".mp4": "Vídeos", ".mkv": "Vídeos", ".avi": "Vídeos", ".mov": "Vídeos",
    ".wmv": "Vídeos", ".flv": "Vídeos", ".webm": "Vídeos", ".m4v": "Vídeos",
    ".ts": "Vídeos", ".vob": "Vídeos", ".3gp": "Vídeos",
    # Áudio
    ".mp3": "Áudios", ".wav": "Áudios", ".flac": "Áudios", ".aac": "Áudios",
    ".ogg": "Áudios", ".m4a": "Áudios", ".opus": "Áudios", ".wma": "Áudios",
    # Imagens
    ".jpg": "Imagens", ".jpeg": "Imagens", ".png": "Imagens", ".gif": "Imagens",
    ".bmp": "Imagens", ".webp": "Imagens", ".svg": "Imagens", ".tiff": "Imagens",
    ".ico": "Imagens", ".heic": "Imagens",
    # Documentos → Word
    ".doc": "Documentos/Word", ".docx": "Documentos/Word", ".rtf": "Documentos/Word",
    # Documentos → Excel
    ".xls": "Documentos/Excel", ".xlsx": "Documentos/Excel", ".csv": "Documentos/Excel",
    # Documentos → PowerPoint
    ".ppt": "Documentos/PowerPoint", ".pptx": "Documentos/PowerPoint",
    # Documentos → PDF
    ".pdf": "Documentos/PDF",
    # Documentos → Texto
    ".txt": "Documentos/Texto",
    # Documentos → LibreOffice
    ".odt": "Documentos/LibreOffice", ".ods": "Documentos/LibreOffice",
    ".odp": "Documentos/LibreOffice", ".odg": "Documentos/LibreOffice",
    # Documentos → eBooks
    ".epub": "Documentos/eBooks", ".mobi": "Documentos/eBooks",
    # Documentos → Código
    ".py": "Documentos/Código", ".js": "Documentos/Código", ".ts": "Documentos/Código",
    ".html": "Documentos/Código", ".css": "Documentos/Código", ".json": "Documentos/Código",
    ".xml": "Documentos/Código", ".sql": "Documentos/Código", ".sh": "Documentos/Código",
    ".bat": "Documentos/Código", ".ps1": "Documentos/Código", ".java": "Documentos/Código",
    ".cpp": "Documentos/Código", ".c": "Documentos/Código", ".go": "Documentos/Código",
    ".rs": "Documentos/Código",
    # Compactados
    ".zip": "Compactados", ".rar": "Compactados", ".7z": "Compactados",
    ".tar": "Compactados", ".gz": "Compactados", ".bz2": "Compactados",
    ".xz": "Compactados", ".tgz": "Compactados",
    # Executáveis
    ".exe": "Programas", ".msi": "Programas", ".apk": "Programas",
    ".deb": "Programas", ".dmg": "Programas",
}


def _categoria(ext: str) -> str:
    return _CATEGORIAS.get(ext.lower(), "Outros")


async def _organizar(req: OrganizeFolderRequest, task_id: str) -> None:
    pm = progress_manager
    orig = req.pasta_origem
    dest = req.pasta_destino
    acao = "movido" if req.mover else "copiado"

    # Coletar arquivos (recursivo ou só raiz, conforme req.incluir_subpastas)
    orig_path = Path(orig)
    if req.incluir_subpastas:
        arquivos = [Path(r) / f for r, _, fs in os.walk(orig) for f in fs]
    else:
        arquivos = [orig_path / f for f in os.listdir(orig) if (orig_path / f).is_file()]
    arquivos.sort(key=lambda p: p.name.lower())

    if not arquivos:
        await pm.add_log(task_id, "ℹ️ Nenhum arquivo encontrado.", "warn")
        await pm.complete_task(task_id, "Nenhum arquivo encontrado.")
        return

    total = len(arquivos)

    # Contar por categoria para o log inicial
    contagem: dict[str, int] = {}
    for arq in arquivos:
        cat = _categoria(arq.suffix)
        contagem[cat] = contagem.get(cat, 0) + 1

    resumo = ", ".join(f"{v} {k}" for k, v in sorted(contagem.items()))
    await pm.add_log(task_id, f"📊 {total} arquivo(s): {resumo}", "info")

    ok = err = 0
    for i, arq in enumerate(arquivos, 1):
        task = pm.get_task(task_id)
        if task and task.cancelada:
            break

        await pm.update_progress(task_id, i, total, f"[{i}/{total}] {arq.name}")

        cat = _categoria(arq.suffix)
        pasta_cat = Path(dest) / cat
        os.makedirs(pasta_cat, exist_ok=True)

        # Resolver conflito de nome
        destino_final = pasta_cat / arq.name
        contador = 2
        while destino_final.exists():
            destino_final = pasta_cat / f"{arq.stem}_{contador}{arq.suffix}"
            contador += 1

        try:
            if req.mover:
                await asyncio.get_running_loop().run_in_executor(
                    None, lambda s=arq, d=destino_final: shutil.move(str(s), str(d))
                )
            else:
                await asyncio.get_running_loop().run_in_executor(
                    None, lambda s=arq, d=destino_final: shutil.copy2(str(s), str(d))
                )
            tamanho = destino_final.stat().st_size
            await pm.add_log(
                task_id,
                f"✅ {arq.name} → {cat}/ ({_fmt_bytes(tamanho)}) {acao}",
                "ok",
            )
            ok += 1
        except Exception as e:
            await pm.add_log(task_id, f"❌ {arq.name}: {e}", "erro")
            err += 1

    msg = f"✅ {ok} arquivo(s) {acao}(s)." + (f" ❌ {err} erro(s)." if err else "")
    await pm.complete_task(task_id, msg)


@router.post("/run", response_model=TaskResponse)
async def organize_folder(req: OrganizeFolderRequest, bg: BackgroundTasks):
    task_id = progress_manager.create_task("organize")
    bg.add_task(_organizar, req, task_id)
    return TaskResponse(task_id=task_id, message="Organização iniciada")


@router.post("/cancel/{task_id}")
async def cancel_organize(task_id: str):
    ok = progress_manager.cancel_task(task_id)
    return {"cancelado": ok}


# ── Organizar por Data ────────────────────────────────────────────

_EXT_FOTO = {
    ".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp",
    ".bmp", ".tiff", ".tif", ".raw", ".cr2", ".nef", ".arw", ".gif",
}
_EXT_VIDEO = {
    ".mp4", ".mkv", ".avi", ".mov", ".m4v", ".wmv",
    ".flv", ".webm", ".ts", ".3gp", ".mts", ".m2ts", ".vob",
}

_MESES_PT = [
    "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

# Padrões de data no nome do arquivo (YYYYMMDD ou YYYY-MM-DD)
_RE_DATA = [
    re.compile(r"(\d{4})[_\-](\d{2})[_\-](\d{2})"),  # 2024_03_15 ou 2024-03-15
    re.compile(r"(\d{4})(\d{2})(\d{2})_"),             # 20240315_
    re.compile(r"(\d{4})(\d{2})(\d{2})[T\s]"),         # 20240315T ou 20240315 (ISO)
    re.compile(r"IMG[-_](\d{4})(\d{2})(\d{2})"),       # IMG_20240315 / IMG-20240315
    re.compile(r"VID[-_](\d{4})(\d{2})(\d{2})"),       # VID_20240315 / VID-20240315
    re.compile(r"PXL[-_](\d{4})(\d{2})(\d{2})"),       # Google Pixel
    re.compile(r"Screenshot[-_](\d{4})(\d{2})(\d{2})"),# Screenshot_20240315
]


def _data_do_exif(path: Path) -> datetime | None:
    """Tenta ler DateTimeOriginal via Pillow EXIF."""
    try:
        from PIL import Image
        from PIL.ExifTags import TAGS
        img = Image.open(path)
        exif_data = img._getexif()  # type: ignore[attr-defined]
        if not exif_data:
            return None
        for tag_id, valor in exif_data.items():
            if TAGS.get(tag_id) in ("DateTimeOriginal", "DateTime"):
                # Formato: "2024:03:15 12:34:56"
                return datetime.strptime(valor, "%Y:%m:%d %H:%M:%S")
    except Exception:
        pass
    return None


def _data_do_nome(path: Path) -> datetime | None:
    """Tenta extrair data do nome do arquivo via regex."""
    nome = path.stem
    for pattern in _RE_DATA:
        m = pattern.search(nome)
        if m:
            try:
                ano, mes, dia = int(m.group(1)), int(m.group(2)), int(m.group(3))
                if 1970 <= ano <= 2100 and 1 <= mes <= 12 and 1 <= dia <= 31:
                    return datetime(ano, mes, dia)
            except (ValueError, IndexError):
                continue
    return None


def _data_arquivo(path: Path) -> datetime:
    """Usa data de modificação do arquivo como fallback."""
    ts = path.stat().st_mtime
    return datetime.fromtimestamp(ts)


def _obter_data(path: Path, fallback: bool) -> datetime | None:
    """Prioridade: EXIF → nome → data do arquivo (se fallback=True)."""
    ext = path.suffix.lower()
    # EXIF só para fotos com suporte
    if ext in {".jpg", ".jpeg", ".heic", ".heif", ".tiff", ".tif"}:
        dt = _data_do_exif(path)
        if dt:
            return dt
    dt = _data_do_nome(path)
    if dt:
        return dt
    if fallback:
        return _data_arquivo(path)
    return None


def _pasta_destino_data(base: str, tipo: str, dt: datetime) -> Path:
    """Monta caminho: base/tipo/AAAA/MM - Mês/"""
    mes_nome = f"{dt.month:02d} - {_MESES_PT[dt.month]}"
    return Path(base) / tipo / str(dt.year) / mes_nome


async def _organizar_por_data(req: OrganizePorDataRequest, task_id: str) -> None:
    pm = progress_manager
    orig = Path(req.pasta_origem)
    dest = req.pasta_destino
    acao = "movido" if req.mover else "copiado"

    # Coletar arquivos
    if req.incluir_subpastas:
        candidatos = [Path(r) / f for r, _, fs in os.walk(orig) for f in fs]
    else:
        candidatos = [orig / f for f in os.listdir(orig) if (orig / f).is_file()]

    # Filtrar só fotos e vídeos
    arquivos: list[tuple[Path, str]] = []
    for p in candidatos:
        ext = p.suffix.lower()
        if ext in _EXT_FOTO:
            arquivos.append((p, "Fotos"))
        elif ext in _EXT_VIDEO:
            arquivos.append((p, "Vídeos"))

    arquivos.sort(key=lambda x: x[0].name.lower())

    if not arquivos:
        await pm.add_log(task_id, "ℹ️ Nenhuma foto ou vídeo encontrado.", "warn")
        await pm.complete_task(task_id, "Nenhum arquivo encontrado.")
        return

    total = len(arquivos)
    n_fotos = sum(1 for _, t in arquivos if t == "Fotos")
    n_videos = total - n_fotos
    await pm.add_log(task_id, f"📊 {total} arquivo(s): {n_fotos} foto(s), {n_videos} vídeo(s)", "info")

    ok = err = sem_data = 0
    for i, (arq, tipo) in enumerate(arquivos, 1):
        task = pm.get_task(task_id)
        if task and task.cancelada:
            break

        await pm.update_progress(task_id, i, total, f"[{i}/{total}] {arq.name}")

        dt = _obter_data(arq, req.fallback_data_arquivo)
        if dt is None:
            await pm.add_log(task_id, f"⚠️ Sem data: {arq.name} → ignorado", "warn")
            sem_data += 1
            continue

        pasta_final = _pasta_destino_data(dest, tipo, dt)
        os.makedirs(pasta_final, exist_ok=True)

        # Resolver conflito de nome
        destino_arq = pasta_final / arq.name
        contador = 2
        while destino_arq.exists():
            destino_arq = pasta_final / f"{arq.stem}_{contador}{arq.suffix}"
            contador += 1

        try:
            if req.mover:
                await asyncio.get_running_loop().run_in_executor(
                    None, lambda s=arq, d=destino_arq: shutil.move(str(s), str(d))
                )
            else:
                await asyncio.get_running_loop().run_in_executor(
                    None, lambda s=arq, d=destino_arq: shutil.copy2(str(s), str(d))
                )
            mes_nome = f"{dt.month:02d} - {_MESES_PT[dt.month]}"
            await pm.add_log(
                task_id,
                f"✅ {arq.name} → {tipo}/{dt.year}/{mes_nome}/ ({acao})",
                "ok",
            )
            ok += 1
        except Exception as e:
            await pm.add_log(task_id, f"❌ {arq.name}: {e}", "erro")
            err += 1

    partes = [f"✅ {ok} arquivo(s) {acao}(s)."]
    if sem_data:
        partes.append(f"⚠️ {sem_data} sem data.")
    if err:
        partes.append(f"❌ {err} erro(s).")
    await pm.complete_task(task_id, " ".join(partes))


@router.post("/por-data", response_model=TaskResponse)
async def organize_por_data(req: OrganizePorDataRequest, bg: BackgroundTasks):
    task_id = progress_manager.create_task("organize_data")
    bg.add_task(_organizar_por_data, req, task_id)
    return TaskResponse(task_id=task_id, message="Organização por data iniciada")


