"""Mapeamento extensão → pasta de destino usado pelo router de organização."""

CATEGORIAS: dict[str, str] = {
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
