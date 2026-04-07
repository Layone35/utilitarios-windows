"""
Gera um índice em .md com a estrutura de pastas de um curso.
Abre uma janela para selecionar a pasta e salvar o arquivo.
"""

import os
import tkinter as tk
from tkinter import filedialog, messagebox


def gerar_indice(pasta_raiz: str) -> str:
    linhas: list[str] = []
    nome_curso = os.path.basename(pasta_raiz.rstrip("/\\"))
    linhas.append(f"# {nome_curso}\n")

    for raiz, dirs, _ in os.walk(pasta_raiz):
        dirs.sort()  # ordem alfabética/numérica
        nivel = raiz.replace(pasta_raiz, "").count(os.sep)
        if nivel == 0:
            continue  # raiz já virou o título
        indent = "  " * nivel
        nome_pasta = os.path.basename(raiz)
        linhas.append(f"{indent}- {nome_pasta}")

    return "\n".join(linhas)


def main() -> None:
    root = tk.Tk()
    root.withdraw()  # esconde a janela principal

    # 1. Seleciona a pasta do curso
    pasta = filedialog.askdirectory(title="Selecione a pasta do curso")
    if not pasta:
        return  # usuário cancelou

    # 2. Gera o conteúdo
    conteudo = gerar_indice(pasta)

    # 3. Escolhe onde salvar
    nome_sugerido = os.path.basename(pasta.rstrip("/\\")) + "_indice.md"
    caminho_saida = filedialog.asksaveasfilename(
        title="Salvar índice como",
        initialdir=pasta,
        initialfile=nome_sugerido,
        defaultextension=".md",
        filetypes=[("Markdown", "*.md"), ("Texto", "*.txt"), ("Todos", "*.*")],
    )
    if not caminho_saida:
        return  # usuário cancelou

    # 4. Salva o arquivo
    with open(caminho_saida, "w", encoding="utf-8") as f:
        f.write(conteudo)

    messagebox.showinfo("Pronto!", f"Índice salvo em:\n{caminho_saida}")


if __name__ == "__main__":
    main()
