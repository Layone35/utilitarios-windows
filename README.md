# 🗂️ Gerenciador de Arquivos — Sistema Unificado v2.1

Aplicação desktop para organizar, comprimir, converter e manter arquivos no Windows.
Interface gráfica escura com 16 funcionalidades em abas.

## ⚡ Início Rápido

```bash
# 1. Clonar
git clone https://github.com/Layone35/gerenciador-cursos.git
cd gerenciador-cursos

# 2. Criar ambiente virtual
python -m venv .venv
.venv\Scripts\activate

# 3. Instalar dependências
pip install -r requirements.txt

# 4. Executar
python gerenciador_cursos.py
```

Ou use o atalho: `iniciar.bat`

## 📋 Funcionalidades

| Aba                | Descrição                                          |
| ------------------ | -------------------------------------------------- |
| 🏠 Início          | Guia rápido de todas as funcionalidades            |
| 📋 Org. Pasta      | Organiza por tipo, prefixo ou migra entre pastas   |
| 📁 Consolidar      | Reúne arquivos de múltiplas subpastas num destino  |
| 🔀 Reorganizar     | Corrige arquivos na pasta de categoria errada      |
| 📡 Auto-Monitor    | Monitora pasta em tempo real (watchdog)            |
| ✏️ Renomear        | Renomeia em lote: sequência, substituição, prefixo |
| 🔍 Duplicatas      | Detecta duplicatas pelo conteúdo (hash)            |
| 🧹 Pastas Vazias   | Remove vazias e aplana "corredores"                |
| 🗜️ ZIPs            | Extrai ZIP/RAR/7z ou compacta em ZIP               |
| 🗜️ Comprimir       | Reduz tamanho de vídeos, imagens, PDFs e áudios    |
| 🎬 Conv. Vídeo     | Converte entre MP4, MKV, AVI, MOV, WebM            |
| 🎵 Conv. Áudio     | Converte entre MP3, WAV, FLAC, OGG, M4A            |
| 🎛️ Modificar Áudio | Pitch, velocidade, EQ em lote                      |
| 🏷️ Metadados       | Edita tags de áudio (título, artista, álbum)       |

## 🔧 Dependências

### Obrigatórias

- Python 3.10+
- tkinter (incluso no Python para Windows)

### Opcionais (instale conforme precisar)

- **Pillow** — compressão de imagens
- **pillow-heif** — suporte a HEIC/HEIF
- **pikepdf** — compressão de PDF
- **pydub** — modificação de áudio
- **mutagen** — edição de metadados
- **librosa + soundfile** — análise de áudio avançada
- **rarfile** — extração de .rar
- **watchdog** — monitoramento em tempo real

### Ferramentas externas

- **ffmpeg** — conversão/compressão de vídeo e áudio (precisa estar no PATH)
- **Ghostscript** — compressão alternativa de PDF

## 📁 Estrutura

```
gerenciador_cursos.py       ← Entry point
gerenciador/
├── app.py                  ← App principal (header, footer, notebook)
├── config.py               ← Persistência de configurações (JSON)
├── constants.py            ← Cores, fontes, extensões
├── deps.py                 ← Import seguro de dependências opcionais
├── utils.py                ← Funções utilitárias
├── widgets.py              ← LogBox, ScrollFrame, AbaBase
└── abas/                   ← Um módulo por funcionalidade
    ├── inicio.py
    ├── organizar_pasta.py
    ├── comprimir.py
    ├── ...
    └── video_mp3.py
```

## 🛡️ Segurança

- Todos os arquivos são processados **localmente** — nada é enviado para a internet
- Operações destrutivas pedem confirmação
- Arquivos originais são preservados nas compressões/conversões
- Configurações salvas em `config_pastas.json` (ignorado no git)

## 📝 Licença

Uso pessoal e privado.
