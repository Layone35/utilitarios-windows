"""
duplicados.py — Encontra e remove arquivos duplicados ou relacionados por nome.

Modos:
  1. Duplicatas exatas   → mesmo conteúdo (hash MD5), qualquer nome/extensão
  2. Famílias por nome   → mesmo stem em pasta, extensões diferentes
                           Ex: relatorio.docx + relatorio.pdf + relatorio_assinado.pdf

Uso:
  python duplicados.py
"""

import os
import sys
import hashlib
import shutil
from pathlib import Path
from collections import defaultdict
from datetime import datetime


# ── Configurações ────────────────────────────────────────────────
TAMANHO_CHUNK = 65_536  # 64 KB por leitura (bom para arquivos grandes)


# ── Helpers ──────────────────────────────────────────────────────

def fmt_tamanho(n: int) -> str:
    for u in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {u}"
        n /= 1024
    return f"{n:.1f} TB"


def fmt_data(ts: float) -> str:
    return datetime.fromtimestamp(ts).strftime("%d/%m/%Y %H:%M")


def md5_arquivo(caminho: Path) -> str:
    h = hashlib.md5()
    try:
        with open(caminho, "rb") as f:
            while chunk := f.read(TAMANHO_CHUNK):
                h.update(chunk)
    except (PermissionError, OSError):
        return ""
    return h.hexdigest()


def listar_arquivos(pasta: Path, recursivo: bool) -> list[Path]:
    if recursivo:
        return [p for p in pasta.rglob("*") if p.is_file()]
    return [p for p in pasta.iterdir() if p.is_file()]


def input_escolha(prompt: str, opcoes: list[str]) -> str:
    while True:
        r = input(prompt).strip().lower()
        if r in opcoes:
            return r
        print(f"  ⚠  Digite uma das opções: {', '.join(opcoes)}")


def exibir_grupo(arquivos: list[Path], titulo: str) -> None:
    print(f"\n  {titulo}")
    for i, arq in enumerate(arquivos, 1):
        try:
            stat = arq.stat()
            tam = fmt_tamanho(stat.st_size)
            data = fmt_data(stat.st_mtime)
        except OSError:
            tam, data = "?", "?"
        print(f"  [{i}] {arq.name}")
        print(f"      📁 {arq.parent}")
        print(f"      💾 {tam}  |  🕐 {data}")


def confirmar_delete(arqs: list[Path], indices: list[int]) -> tuple[list[Path], int]:
    """Mostra o que será deletado e pede confirmação. Retorna (arquivos_deletados, bytes_liberados)."""
    a_deletar = [arqs[i - 1] for i in indices if 1 <= i <= len(arqs)]
    if not a_deletar:
        print("  ℹ  Nenhum arquivo selecionado.")
        return [], 0

    print("\n  ⚠  Serão DELETADOS permanentemente:")
    total_bytes = 0
    for arq in a_deletar:
        try:
            tam = arq.stat().st_size
            total_bytes += tam
            print(f"     ✗ {arq}  ({fmt_tamanho(tam)})")
        except OSError:
            print(f"     ✗ {arq}")

    ok = input_escolha(
        f"\n  Confirmar exclusão de {len(a_deletar)} arquivo(s)? [s/n] → ",
        ["s", "n"],
    )
    if ok != "s":
        print("  ↩  Cancelado.")
        return [], 0

    deletados = []
    for arq in a_deletar:
        try:
            arq.unlink()
            print(f"  🗑  Deletado: {arq.name}")
            deletados.append(arq)
        except Exception as e:
            print(f"  ❌ Erro ao deletar {arq.name}: {e}")

    return deletados, total_bytes


def parse_indices(texto: str, maximo: int) -> list[int]:
    """Converte '1 3 5' ou '1,3,5' em [1, 3, 5] validando os limites."""
    texto = texto.replace(",", " ")
    result = []
    for parte in texto.split():
        try:
            n = int(parte)
            if 1 <= n <= maximo:
                result.append(n)
        except ValueError:
            pass
    return list(set(result))


# ── Modo 1: Duplicatas exatas ────────────────────────────────────

def modo_duplicatas_exatas(pasta: Path, recursivo: bool) -> None:
    print(f"\n🔍 Escaneando {'recursivamente ' if recursivo else ''}em: {pasta}")
    arquivos = listar_arquivos(pasta, recursivo)
    print(f"   {len(arquivos)} arquivo(s) encontrado(s). Calculando hashes...\n")

    # 1ª passagem: agrupar por tamanho (evita calcular hash de arquivos únicos)
    por_tamanho: dict[int, list[Path]] = defaultdict(list)
    for arq in arquivos:
        try:
            por_tamanho[arq.stat().st_size].append(arq)
        except OSError:
            pass

    candidatos = [lst for lst in por_tamanho.values() if len(lst) > 1]
    if not candidatos:
        print("✅ Nenhuma duplicata encontrada (nenhum arquivo com mesmo tamanho).")
        return

    # 2ª passagem: agrupar por MD5
    por_hash: dict[str, list[Path]] = defaultdict(list)
    total_candidatos = sum(len(l) for l in candidatos)
    processados = 0
    for grupo in candidatos:
        for arq in grupo:
            processados += 1
            print(f"\r   Hash: {processados}/{total_candidatos}...", end="", flush=True)
            h = md5_arquivo(arq)
            if h:
                por_hash[h].append(arq)
    print()

    grupos_dup = {h: lst for h, lst in por_hash.items() if len(lst) > 1}
    if not grupos_dup:
        print("✅ Nenhuma duplicata exata encontrada.")
        return

    total_grupos = len(grupos_dup)
    espaco_recuperavel = sum(
        sum(a.stat().st_size for a in lst[1:]) for lst in grupos_dup.values()
        if all(a.exists() for a in lst[1:])
    )
    print(f"\n📋 {total_grupos} grupo(s) de duplicatas — potencial: {fmt_tamanho(espaco_recuperavel)}\n")
    print("─" * 60)

    total_deletados = 0
    total_bytes = 0

    for idx, (h, arquivos_dup) in enumerate(grupos_dup.items(), 1):
        print(f"\n{'─'*60}")
        print(f"Grupo {idx}/{total_grupos}  •  Hash: {h[:12]}...  •  {len(arquivos_dup)} cópias idênticas")
        exibir_grupo(arquivos_dup, "Arquivos idênticos:")

        print("\n  O que fazer?")
        print("  [k]  Manter todos (pular)")
        print("  [d]  Escolher quais DELETAR (digitar números)")
        print("  [1-9] Manter APENAS este número (deleta os outros)")
        print("  [q]  Sair do scanner")

        acao = input("  → ").strip().lower()

        if acao == "q":
            break
        elif acao == "k" or acao == "":
            continue
        elif acao.lstrip("-").isdigit():
            n = int(acao)
            if 1 <= n <= len(arquivos_dup):
                indices = [i for i in range(1, len(arquivos_dup) + 1) if i != n]
                dels, byt = confirmar_delete(arquivos_dup, indices)
                total_deletados += len(dels)
                total_bytes += byt
            else:
                print("  ℹ  Número inválido.")
        elif acao == "d":
            ids_txt = input(f"  Números para deletar (1-{len(arquivos_dup)}, separados por espaço): ")
            indices = parse_indices(ids_txt, len(arquivos_dup))
            dels, byt = confirmar_delete(arquivos_dup, indices)
            total_deletados += len(dels)
            total_bytes += byt

    print(f"\n{'═'*60}")
    print(f"✅ Sessão concluída: {total_deletados} arquivo(s) deletado(s) • {fmt_tamanho(total_bytes)} liberado(s)")


# ── Modo 2: Famílias por nome (stem) ─────────────────────────────

def modo_familias_por_nome(pasta: Path, recursivo: bool) -> None:
    """
    Agrupa arquivos com mesmo stem (nome sem extensão) na mesma pasta.
    Ex: relatorio.docx + relatorio.pdf + relatorio_assinado.pdf
    """
    print(f"\n🔍 Buscando famílias de nomes em: {pasta}")

    arquivos = listar_arquivos(pasta, recursivo)

    # Agrupar por (pasta, stem_base) — ignora sufixos como _assinado, _v2 etc.
    # Primeiro: agrupamento exato por stem
    por_pasta_stem: dict[tuple[Path, str], list[Path]] = defaultdict(list)
    for arq in arquivos:
        por_pasta_stem[(arq.parent, arq.stem)].append(arq)

    # Segundo: agrupamento por stem_base (stem sem sufixo _xxx no final)
    # Isso pega relatorio.docx + relatorio.pdf + relatorio_assinado.pdf
    por_base: dict[tuple[Path, str], list[Path]] = defaultdict(list)
    for arq in arquivos:
        # Tenta remover sufixo _algo do stem
        stem = arq.stem
        base = stem
        for sep in ("_assinado", "_signed", "_aprovado", "_final", "_v2", "_v1", "_copia", "_copy", "_backup"):
            if stem.lower().endswith(sep):
                base = stem[: -len(sep)]
                break
        por_base[(arq.parent, base.lower())].append(arq)

    grupos = {k: sorted(v, key=lambda p: p.suffix) for k, v in por_base.items() if len(v) > 1}

    if not grupos:
        print("✅ Nenhuma família de arquivos relacionados encontrada.")
        return

    total_grupos = len(grupos)
    print(f"\n📋 {total_grupos} família(s) encontrada(s)\n")
    print("─" * 60)

    total_deletados = 0
    total_bytes = 0

    for idx, ((pasta_arq, base), grupo) in enumerate(grupos.items(), 1):
        # Calcular tamanho total
        tamanho_total = sum(a.stat().st_size for a in grupo if a.exists())

        print(f"\n{'─'*60}")
        print(f"Família {idx}/{total_grupos}  •  Base: '{base}'  •  {fmt_tamanho(tamanho_total)} total")
        exibir_grupo(grupo, "Arquivos relacionados:")

        print("\n  O que fazer?")
        print("  [k]  Manter todos (pular)")
        print("  [d]  Escolher quais DELETAR (digitar números)")
        print("  [1-9] Manter APENAS este número (deleta os outros)")
        print("  [q]  Sair do scanner")

        acao = input("  → ").strip().lower()

        if acao == "q":
            break
        elif acao == "k" or acao == "":
            continue
        elif acao.lstrip("-").isdigit():
            n = int(acao)
            if 1 <= n <= len(grupo):
                indices = [i for i in range(1, len(grupo) + 1) if i != n]
                dels, byt = confirmar_delete(grupo, indices)
                total_deletados += len(dels)
                total_bytes += byt
            else:
                print("  ℹ  Número inválido.")
        elif acao == "d":
            ids_txt = input(f"  Números para deletar (1-{len(grupo)}, separados por espaço): ")
            indices = parse_indices(ids_txt, len(grupo))
            dels, byt = confirmar_delete(grupo, indices)
            total_deletados += len(dels)
            total_bytes += byt

    print(f"\n{'═'*60}")
    print(f"✅ Sessão concluída: {total_deletados} arquivo(s) deletado(s) • {fmt_tamanho(total_bytes)} liberado(s)")


# ── Main ──────────────────────────────────────────────────────────

def main() -> None:
    print("═" * 60)
    print("  🗂  Scanner de Duplicatas e Famílias de Arquivos")
    print("═" * 60)

    # Pasta
    pasta_txt = input("\n  📂 Pasta para escanear (Enter = pasta atual): ").strip().strip('"')
    if not pasta_txt:
        pasta = Path.cwd()
    else:
        pasta = Path(pasta_txt)

    if not pasta.exists() or not pasta.is_dir():
        print(f"  ❌ Pasta não encontrada: {pasta}")
        sys.exit(1)

    # Recursivo?
    rec_txt = input_escolha("  🔁 Incluir subpastas? [s/n] → ", ["s", "n"])
    recursivo = rec_txt == "s"

    # Modo
    print("\n  Modo de busca:")
    print("  [1]  Duplicatas exatas    — mesmo conteúdo (qualquer nome/extensão)")
    print("  [2]  Famílias por nome    — ex: relatorio.docx + relatorio.pdf + relatorio_assinado.pdf")
    print("  [3]  Ambos")

    modo = input_escolha("  → ", ["1", "2", "3"])

    if modo in ("1", "3"):
        modo_duplicatas_exatas(pasta, recursivo)

    if modo in ("2", "3"):
        modo_familias_por_nome(pasta, recursivo)

    print("\n  Pressione Enter para fechar...")
    input()


if __name__ == "__main__":
    main()
