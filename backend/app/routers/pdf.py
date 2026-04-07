"""Router de PDF — juntar/mesclar PDFs (suporta assinados)."""
import os
import asyncio
import shutil
import subprocess
import tempfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks

from app.models.schemas import MergePdfRequest, RemoveSenhaPdfRequest, ConvertToPdfRequest, TaskResponse
from app.services.progress import progress_manager

router = APIRouter(prefix="/api/pdf", tags=["pdf"])


def _fmt_bytes(n: int) -> str:
    for u in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {u}"
        n /= 1024
    return f"{n:.1f} TB"


async def _juntar_pdfs(req: MergePdfRequest, task_id: str) -> None:
    """Junta múltiplos PDFs em um único arquivo."""
    pm = progress_manager

    try:
        from pypdf import PdfWriter, PdfReader
    except ImportError:
        await pm.add_log(task_id, "❌ pypdf não instalado. Execute: pip install pypdf", "erro")
        await pm.complete_task(task_id, "pypdf não instalado.")
        return

    # Encontrar PDFs (recursivo ou só raiz)
    orig = Path(req.pasta_origem)
    if req.incluir_subpastas:
        arquivos = [
            Path(r) / f
            for r, _, fs in os.walk(req.pasta_origem)
            for f in fs if Path(f).suffix.lower() == ".pdf"
        ]
    else:
        arquivos = [
            orig / f
            for f in os.listdir(req.pasta_origem)
            if (orig / f).is_file() and Path(f).suffix.lower() == ".pdf"
        ]

    if req.ordenar_por_nome:
        arquivos.sort(key=lambda p: p.name.lower())

    if not arquivos:
        await pm.add_log(task_id, "ℹ️ Nenhum PDF encontrado na pasta.", "warn")
        await pm.complete_task(task_id, "Nenhum PDF encontrado.")
        return

    total = len(arquivos)
    await pm.add_log(task_id, f"📄 {total} PDF(s) encontrado(s). Iniciando junção...", "info")

    # Criar diretório de destino se necessário
    saida = Path(req.arquivo_saida)
    os.makedirs(saida.parent, exist_ok=True)

    writer = PdfWriter()
    ok = err = 0
    total_paginas = 0

    for i, arq in enumerate(arquivos, 1):
        task = pm.get_task(task_id)
        if task and task.cancelada:
            break

        await pm.update_progress(task_id, i, total, f"[{i}/{total}] {arq.name}")

        try:
            def _ler_pdf(caminho=arq):
                """Lê PDF ignorando assinaturas digitais."""
                reader = PdfReader(str(caminho), strict=False)
                paginas = []
                for page in reader.pages:
                    paginas.append(page)
                return paginas, len(reader.pages)

            paginas, num_pags = await asyncio.get_event_loop().run_in_executor(None, _ler_pdf)

            for page in paginas:
                writer.add_page(page)

            total_paginas += num_pags
            await pm.add_log(
                task_id,
                f"✅ {arq.name} — {num_pags} página(s) ({_fmt_bytes(arq.stat().st_size)})",
                "ok",
            )
            ok += 1
        except Exception as e:
            await pm.add_log(task_id, f"❌ {arq.name}: {e}", "erro")
            err += 1

    if ok == 0:
        await pm.complete_task(task_id, "Nenhum PDF pôde ser processado.")
        return

    # Salvar arquivo mesclado
    try:
        def _salvar():
            with open(str(saida), "wb") as f:
                writer.write(f)

        await asyncio.get_event_loop().run_in_executor(None, _salvar)

        tamanho_final = saida.stat().st_size
        msg = (
            f"✅ {ok} PDF(s) mesclado(s) → {total_paginas} páginas "
            f"({_fmt_bytes(tamanho_final)})"
        )
        if err:
            msg += f" ❌ {err} erro(s)."
        await pm.add_log(task_id, f"📦 Salvo em: {saida}", "ok")
        await pm.complete_task(task_id, msg)
    except Exception as e:
        await pm.add_log(task_id, f"❌ Erro ao salvar: {e}", "erro")
        await pm.complete_task(task_id, "Erro ao salvar PDF final.")


# ── Endpoints ────────────────────────────────────────────────────
@router.post("/merge", response_model=TaskResponse)
async def merge_pdfs(req: MergePdfRequest, bg: BackgroundTasks):
    task_id = progress_manager.create_task("merge_pdf")
    bg.add_task(_juntar_pdfs, req, task_id)
    return TaskResponse(task_id=task_id, message="Junção de PDFs iniciada")


@router.post("/cancel/{task_id}")
async def cancel_merge(task_id: str):
    ok = progress_manager.cancel_task(task_id)
    return {"cancelado": ok}


# ── Remover senha ─────────────────────────────────────────────────
async def _remover_senha_pdf(req: RemoveSenhaPdfRequest, task_id: str) -> None:
    """Remove a senha de proteção de um PDF."""
    pm = progress_manager

    try:
        import pikepdf
    except ImportError:
        await pm.add_log(task_id, "❌ pikepdf não instalado. Execute: pip install pikepdf", "erro")
        await pm.complete_task(task_id, "pikepdf não instalado.")
        return

    entrada = Path(req.arquivo_entrada)
    if not entrada.exists():
        await pm.add_log(task_id, f"❌ Arquivo não encontrado: {entrada}", "erro")
        await pm.complete_task(task_id, "Arquivo não encontrado.")
        return

    saida_str = req.arquivo_saida.strip()
    if not saida_str:
        saida_str = str(entrada.with_name(entrada.stem + "_sem_senha" + entrada.suffix))
    saida = Path(saida_str)
    os.makedirs(saida.parent, exist_ok=True)

    await pm.add_log(task_id, f"🔓 Removendo senha de: {entrada.name}", "info")
    await pm.update_progress(task_id, 0, 1, "Abrindo PDF...")

    try:
        def _processar():
            with pikepdf.open(str(entrada), password=req.senha) as pdf:
                pdf.save(str(saida))
            return saida.stat().st_size

        tamanho = await asyncio.get_event_loop().run_in_executor(None, _processar)
        await pm.update_progress(task_id, 1, 1, "Concluído")
        await pm.add_log(task_id, f"📦 Salvo em: {saida}", "ok")
        await pm.complete_task(
            task_id,
            f"✅ Senha removida com sucesso! ({_fmt_bytes(tamanho)})",
        )
    except pikepdf.PasswordError:
        await pm.add_log(task_id, "❌ Senha incorreta.", "erro")
        await pm.complete_task(task_id, "Senha incorreta.")
    except Exception as e:
        await pm.add_log(task_id, f"❌ Erro: {e}", "erro")
        await pm.complete_task(task_id, "Erro ao processar PDF.")


@router.post("/remove-senha", response_model=TaskResponse)
async def remove_senha_pdf(req: RemoveSenhaPdfRequest, bg: BackgroundTasks):
    task_id = progress_manager.create_task("remove_senha_pdf")
    bg.add_task(_remover_senha_pdf, req, task_id)
    return TaskResponse(task_id=task_id, message="Removendo senha do PDF...")


# ── Converter para PDF ─────────────────────────────────────────────
async def _converter_para_pdf(req: ConvertToPdfRequest, task_id: str) -> None:
    """Converte .docx, .txt e .md para PDF via LibreOffice headless."""
    pm = progress_manager

    # Verificar se LibreOffice está disponível
    soffice = shutil.which("soffice")
    if not soffice:
        # Tentar caminhos padrão no Windows
        possiveis = [
            r"C:\Program Files\LibreOffice\program\soffice.exe",
            r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        ]
        for p in possiveis:
            if Path(p).exists():
                soffice = p
                break

    if not soffice:
        await pm.add_log(
            task_id,
            "❌ LibreOffice não encontrado. Instale em: https://www.libreoffice.org/",
            "erro",
        )
        await pm.complete_task(task_id, "LibreOffice não encontrado.")
        return

    orig = req.pasta_origem
    dest = req.pasta_destino
    os.makedirs(dest, exist_ok=True)

    _EXTS = {".docx", ".doc", ".txt", ".md", ".odt", ".rtf", ".pptx", ".ppt", ".odp", ".pps", ".ppsx"}

    if req.incluir_subpastas:
        arquivos = sorted([
            Path(r) / f
            for r, _, fs in os.walk(orig)
            for f in fs if Path(f).suffix.lower() in _EXTS
        ])
    else:
        arquivos = sorted([
            Path(orig) / f
            for f in os.listdir(orig)
            if Path(f).suffix.lower() in _EXTS and (Path(orig) / f).is_file()
        ])

    if not arquivos:
        await pm.add_log(task_id, "ℹ️ Nenhum arquivo .docx/.txt/.md encontrado.", "warn")
        await pm.complete_task(task_id, "Nenhum arquivo encontrado.")
        return

    total = len(arquivos)
    await pm.add_log(task_id, f"📄 {total} arquivo(s) encontrado(s). Iniciando conversão...", "info")

    ok = err = 0
    tmp_dir = None

    for i, arq in enumerate(arquivos, 1):
        task = pm.get_task(task_id)
        if task and task.cancelada:
            break

        await pm.update_progress(task_id, i, total, f"[{i}/{total}] {arq.name}")

        try:
            # Para .md: converter para HTML primeiro
            arquivo_para_converter = arq
            tmp_html: Path | None = None

            if arq.suffix.lower() == ".md":
                try:
                    import markdown as md_lib
                except ImportError:
                    await pm.add_log(
                        task_id,
                        "❌ lib 'markdown' não instalada. Execute: pip install markdown",
                        "erro",
                    )
                    err += 1
                    continue

                conteudo_md = arq.read_text(encoding="utf-8", errors="replace")
                html_body = md_lib.markdown(conteudo_md, extensions=["tables", "fenced_code"])
                html_completo = f"""<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<style>
  body {{ font-family: Arial, sans-serif; margin: 2cm; line-height: 1.6; }}
  h1,h2,h3 {{ color: #333; }}
  pre {{ background: #f4f4f4; padding: 1em; border-radius: 4px; overflow-x: auto; }}
  code {{ background: #f4f4f4; padding: 2px 4px; border-radius: 2px; }}
  table {{ border-collapse: collapse; width: 100%; }}
  th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
  th {{ background: #f2f2f2; }}
</style>
</head><body>{html_body}</body></html>"""

                if tmp_dir is None:
                    tmp_dir = tempfile.mkdtemp()
                tmp_html = Path(tmp_dir) / (arq.stem + ".html")
                tmp_html.write_text(html_completo, encoding="utf-8")
                arquivo_para_converter = tmp_html

            # Rodar LibreOffice para converter para PDF
            def _converter(entrada: Path = arquivo_para_converter, saida_dir: str = dest):
                creationflags = subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0
                result = subprocess.run(
                    [
                        soffice,
                        "--headless",
                        "--convert-to", "pdf",
                        "--outdir", saida_dir,
                        str(entrada),
                    ],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.PIPE,
                    timeout=120,
                    creationflags=creationflags,
                )
                return result.returncode, result.stderr.decode("utf-8", errors="replace")

            returncode, stderr_out = await asyncio.get_event_loop().run_in_executor(
                None, _converter
            )

            # LibreOffice salva com o nome do arquivo de entrada + .pdf
            # Se era .md convertido para .html, o pdf vai ter nome do .html
            # Precisamos renomear para o nome original do .md
            pdf_gerado_nome = arquivo_para_converter.stem + ".pdf"
            pdf_gerado = Path(dest) / pdf_gerado_nome

            # Se foi .md e o pdf foi gerado com nome do .html, renomear para nome do .md
            if tmp_html is not None and pdf_gerado.exists():
                pdf_final = Path(dest) / (arq.stem + ".pdf")
                if pdf_final != pdf_gerado:
                    if pdf_final.exists():
                        pdf_final.unlink()
                    pdf_gerado.rename(pdf_final)
                    pdf_gerado = pdf_final

            if returncode == 0 and pdf_gerado.exists():
                tamanho = pdf_gerado.stat().st_size
                await pm.add_log(
                    task_id,
                    f"✅ {arq.name} → {pdf_gerado.name} ({_fmt_bytes(tamanho)})",
                    "ok",
                )
                ok += 1
            else:
                detalhe = stderr_out.strip()[:200] if stderr_out.strip() else "sem detalhes"
                await pm.add_log(task_id, f"❌ {arq.name}: {detalhe}", "erro")
                err += 1

        except Exception as e:
            await pm.add_log(task_id, f"❌ {arq.name}: {e}", "erro")
            err += 1

    # Limpar arquivos temporários
    if tmp_dir and Path(tmp_dir).exists():
        shutil.rmtree(tmp_dir, ignore_errors=True)

    msg = f"✅ {ok} convertido(s) para PDF." + (f" ❌ {err} erro(s)." if err else "")
    await pm.complete_task(task_id, msg)


@router.post("/convert-to-pdf", response_model=TaskResponse)
async def convert_to_pdf(req: ConvertToPdfRequest, bg: BackgroundTasks):
    task_id = progress_manager.create_task("convert_to_pdf")
    bg.add_task(_converter_para_pdf, req, task_id)
    return TaskResponse(task_id=task_id, message="Conversão para PDF iniciada...")
