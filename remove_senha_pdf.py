#!/usr/bin/env python3
"""Remove a senha de um PDF protegido por senha."""

import sys
import pikepdf
from pathlib import Path


def remover_senha(arquivo_entrada: str, senha: str, arquivo_saida: str | None = None) -> None:
    entrada = Path(arquivo_entrada)

    if not entrada.exists():
        print(f"Erro: arquivo '{arquivo_entrada}' não encontrado.")
        sys.exit(1)

    if arquivo_saida is None:
        arquivo_saida = str(entrada.with_name(entrada.stem + "_sem_senha" + entrada.suffix))

    try:
        with pikepdf.open(entrada, password=senha) as pdf:
            pdf.save(arquivo_saida)
        print(f"✓ PDF salvo sem senha em: {arquivo_saida}")
    except pikepdf.PasswordError:
        print("Erro: senha incorreta.")
        sys.exit(1)
    except Exception as e:
        print(f"Erro inesperado: {e}")
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python remove_senha_pdf.py <arquivo.pdf> <senha> [saida.pdf]")
        print("Exemplo: python remove_senha_pdf.py fatura.pdf 12345")
        sys.exit(1)

    arquivo = sys.argv[1]
    senha = sys.argv[2]
    saida = sys.argv[3] if len(sys.argv) > 3 else None

    remover_senha(arquivo, senha, saida)
