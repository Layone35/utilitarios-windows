"""Funções utilitárias compartilhadas entre todos os routers."""
import os
from pathlib import Path


def _fmt_bytes(n: int) -> str:
    for u in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {u}"
        n /= 1024
    return f"{n:.1f} TB"


def _fmt_tempo(seg: float) -> str:
    seg = int(seg)
    if seg < 60:
        return f"{seg}s"
    m, s = divmod(seg, 60)
    if m < 60:
        return f"{m}m{s:02d}s"
    h, m = divmod(m, 60)
    return f"{h}h{m:02d}m{s:02d}s"


def _scan(pasta: str, exts: set[str] | None, subpastas: bool) -> list[Path]:
    """Lista arquivos filtrando por extensões. exts=None retorna todos."""
    orig = Path(pasta)
    if subpastas:
        candidatos = (Path(r) / f for r, _, fs in os.walk(pasta) for f in fs)
    else:
        candidatos = (orig / f for f in os.listdir(pasta) if (orig / f).is_file())
    if exts is None:
        return sorted(candidatos)
    return sorted(p for p in candidatos if p.suffix.lower() in exts)


def _resolver_nome(pasta: str, nome: str) -> Path:
    """Gera caminho único no destino, adicionando sufixo _N se já existir."""
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
