"""Router utilitário — browse de pastas (diálogo nativo do OS)."""
import asyncio
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/utils", tags=["utils"])


class BrowseResponse(BaseModel):
    path: str
    ok: bool


@router.get("/browse", response_model=BrowseResponse)
async def browse_folder():
    """Abre o seletor de pastas nativo do Windows e retorna o caminho."""
    path = await asyncio.get_event_loop().run_in_executor(None, _open_folder_dialog)
    return BrowseResponse(path=path, ok=bool(path))


def _open_folder_dialog() -> str:
    """Abre tkinter.filedialog em uma thread separada."""
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()  # Esconde a janela principal
        root.attributes("-topmost", True)  # Coloca o diálogo na frente
        folder = filedialog.askdirectory(title="Selecionar Pasta")
        root.destroy()
        return folder if folder else ""
    except Exception:
        return ""


@router.get("/browse-file", response_model=BrowseResponse)
async def browse_file(filetypes: str = "pdf"):
    """Abre o seletor de arquivo nativo do Windows e retorna o caminho."""
    path = await asyncio.get_event_loop().run_in_executor(None, _open_file_dialog, filetypes)
    return BrowseResponse(path=path, ok=bool(path))


def _open_file_dialog(filetypes: str = "pdf") -> str:
    """Abre tkinter.filedialog.askopenfilename em uma thread separada."""
    try:
        import tkinter as tk
        from tkinter import filedialog

        type_map: dict[str, list[tuple[str, str]]] = {
            "pdf": [("PDF", "*.pdf"), ("Todos", "*.*")],
            "txt": [("Texto", "*.txt"), ("Todos", "*.*")],
        }
        types = type_map.get(filetypes, [("Todos", "*.*")])

        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        file = filedialog.askopenfilename(title="Selecionar Arquivo", filetypes=types)
        root.destroy()
        return file if file else ""
    except Exception:
        return ""


@router.get("/validate-path")
async def validate_path(path: str):
    """Valida se um caminho existe no sistema."""
    p = Path(path)
    return {
        "exists": p.exists(),
        "is_dir": p.is_dir(),
        "is_file": p.is_file(),
    }
