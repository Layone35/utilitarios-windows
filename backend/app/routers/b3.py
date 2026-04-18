"""Router B3 — Parser do arquivo COTAHIST (Série Histórica de Cotações B3)."""
import os
import csv
import asyncio
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks

from app.models.schemas import B3ParseRequest, TaskResponse
from app.services.progress import progress_manager

router = APIRouter(prefix="/api/b3", tags=["b3"])

# Layout COTAHIST — posições 0-indexed (slices Python)
_LAYOUT = {
    "TIPREG":  (0,   2),   # Tipo de registro ("01" = dados)
    "DATPRE":  (2,   10),  # Data pregão YYYYMMDD
    "CODBDI":  (10,  12),  # Código BDI
    "CODNEG":  (12,  24),  # Código de negociação (ticker)
    "TPMERC":  (24,  27),  # Tipo de mercado (010=à vista, 020=fracionário)
    "NOMRES":  (27,  39),  # Nome resumido
    "ESPECI":  (39,  49),  # Especificação do papel
    "MODREF":  (52,  56),  # Moeda de referência
    "PREABE":  (56,  69),  # Preço de abertura
    "PREMAX":  (69,  82),  # Preço máximo
    "PREMIN":  (82,  95),  # Preço mínimo
    "PREMED":  (95,  108), # Preço médio
    "PREOFV":  (108, 121), # Preço de fechamento
    "PREULT":  (121, 134), # Preço do último negócio
    "TOTNEG":  (147, 152), # Total de negócios
    "QUATOT":  (152, 170), # Quantidade total de papéis
    "VOLTOT":  (170, 188), # Volume total em R$
    "FATCOT":  (210, 217), # Fator de cotação
    "CODISI":  (230, 242), # Código ISIN
}


def _campo(line: str, nome: str) -> str:
    s, e = _LAYOUT[nome]
    return line[s:e].strip()


def _preco(line: str, nome: str, fatcot: int) -> float:
    """Retorna preço em R$ corrigido pelo fator de cotação."""
    raw = _campo(line, nome)
    if not raw:
        return 0.0
    return round(int(raw) / 100 / max(fatcot, 1), 4)


def _fmt_data(datpre: str) -> str:
    """Converte YYYYMMDD → YYYY-MM-DD."""
    try:
        return datetime.strptime(datpre, "%Y%m%d").strftime("%Y-%m-%d")
    except ValueError:
        return datpre


def _listar_txts(caminho: str) -> list[Path]:
    """Retorna lista de arquivos TXT do caminho (arquivo único ou pasta)."""
    p = Path(caminho)
    if p.is_file() and p.suffix.upper() == ".TXT":
        return [p]
    if p.is_dir():
        return sorted(p.glob("*.TXT")) + sorted(p.glob("*.txt"))
    return []


async def _parsear_b3(req: B3ParseRequest, task_id: str) -> None:
    pm = progress_manager
    ticker = req.ticker.strip().upper()

    arquivos = _listar_txts(req.pasta_ou_arquivo)
    if not arquivos:
        await pm.add_log(task_id, "❌ Nenhum arquivo TXT encontrado.", "erro")
        await pm.complete_task(task_id, "Nenhum arquivo encontrado.")
        return

    await pm.add_log(task_id, f"📂 {len(arquivos)} arquivo(s) TXT encontrado(s)", "info")

    # Definir pasta de destino
    if req.pasta_destino.strip():
        pasta_out = Path(req.pasta_destino.strip())
    else:
        pasta_out = arquivos[0].parent
    os.makedirs(pasta_out, exist_ok=True)

    # Nome do CSV de saída
    csv_path = pasta_out / f"{ticker}_COTAHIST.csv"

    # Tipos de mercado aceitos
    tipos_aceitos: set[str] = set()
    if req.apenas_vista:
        tipos_aceitos.add("010")  # à vista
    if req.incluir_fracionario:
        tipos_aceitos.add("020")  # fracionário
    if not tipos_aceitos:
        tipos_aceitos.add("010")  # fallback: sempre inclui à vista

    colunas = [
        "data", "codigo", "nome", "especificacao", "tipo_mercado",
        "cod_bdi", "isin",
        "abertura", "maxima", "minima", "media", "fechamento", "ultimo",
        "negocios", "quantidade", "volume_r",
    ]

    total_linhas = 0
    total_registros = 0

    def _processar_arquivo(arq: Path, writer: csv.DictWriter) -> tuple[int, int]:
        linhas = 0
        registros = 0
        try:
            with open(arq, "r", encoding="latin-1", errors="replace") as f:
                for line in f:
                    line = line.rstrip("\n\r")
                    linhas += 1
                    if len(line) < 13:
                        continue
                    if line[0:2] != "01":
                        continue  # pula header/trailer
                    codneg = line[12:24].strip()
                    if codneg != ticker:
                        continue
                    tpmerc = line[24:27].strip()
                    if tpmerc not in tipos_aceitos:
                        continue

                    fatcot_raw = line[210:217].strip() if len(line) >= 217 else "1"
                    try:
                        fatcot = int(fatcot_raw) or 1
                    except ValueError:
                        fatcot = 1

                    writer.writerow({
                        "data":          _fmt_data(_campo(line, "DATPRE")),
                        "codigo":        codneg,
                        "nome":          _campo(line, "NOMRES"),
                        "especificacao": _campo(line, "ESPECI"),
                        "tipo_mercado":  tpmerc,
                        "cod_bdi":       _campo(line, "CODBDI"),
                        "isin":          _campo(line, "CODISI"),
                        "abertura":      _preco(line, "PREABE", fatcot),
                        "maxima":        _preco(line, "PREMAX", fatcot),
                        "minima":        _preco(line, "PREMIN", fatcot),
                        "media":         _preco(line, "PREMED", fatcot),
                        "fechamento":    _preco(line, "PREOFV", fatcot),
                        "ultimo":        _preco(line, "PREULT", fatcot),
                        "negocios":      int(_campo(line, "TOTNEG") or 0),
                        "quantidade":    int(_campo(line, "QUATOT") or 0),
                        "volume_r":      round(int(_campo(line, "VOLTOT") or 0) / 100, 2),
                    })
                    registros += 1
        except Exception as e:
            raise RuntimeError(f"Erro ao ler {arq.name}: {e}")
        return linhas, registros

    try:
        with open(csv_path, "w", newline="", encoding="utf-8") as fout:
            writer = csv.DictWriter(fout, fieldnames=colunas)
            writer.writeheader()

            for i, arq in enumerate(arquivos, 1):
                task = pm.get_task(task_id)
                if task and task.cancelada:
                    break

                await pm.update_progress(task_id, i, len(arquivos), f"[{i}/{len(arquivos)}] {arq.name}")
                await pm.add_log(task_id, f"🔍 Processando {arq.name}...", "info")

                linhas, registros = await asyncio.get_running_loop().run_in_executor(
                    None, lambda a=arq: _processar_arquivo(a, writer)
                )
                total_linhas += linhas
                total_registros += registros
                await pm.add_log(
                    task_id,
                    f"✅ {arq.name}: {registros} registro(s) de {ticker} em {linhas:,} linhas",
                    "ok",
                )
    except Exception as e:
        await pm.add_log(task_id, f"❌ {e}", "erro")
        await pm.complete_task(task_id, f"Erro: {e}")
        return

    if total_registros == 0:
        await pm.add_log(task_id, f"⚠️ Ticker '{ticker}' não encontrado nos arquivos.", "warn")
        await pm.complete_task(task_id, f"Nenhum registro de {ticker} encontrado.")
        return

    await pm.add_log(task_id, f"📊 CSV gerado: {csv_path.name}", "ok")
    msg = f"✅ {total_registros} registro(s) de {ticker} exportado(s) → {csv_path.name}"
    await pm.complete_task(task_id, msg)


@router.post("/parse", response_model=TaskResponse)
async def parse_b3(req: B3ParseRequest, bg: BackgroundTasks):
    task_id = progress_manager.create_task("b3_parse")
    bg.add_task(_parsear_b3, req, task_id)
    return TaskResponse(task_id=task_id, message=f"Parser B3 iniciado para {req.ticker.upper()}")


@router.post("/cancel/{task_id}")
async def cancel_b3(task_id: str):
    ok = progress_manager.cancel_task(task_id)
    return {"cancelado": ok}
