"""Control Pro — Backend API para automações locais."""
import atexit
import subprocess
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.routers import video, audio, folders, compress, utils, pdf, organize, b3, duplicatas
from app.services.progress import progress_manager
from app.models.schemas import HealthResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    yield
    # shutdown — mata todos os processos ffmpeg em andamento
    progress_manager.kill_all()


# Registra também via atexit para cobrir saídas abruptas
atexit.register(progress_manager.kill_all)

app = FastAPI(
    title="Control Pro API",
    description="Backend API para automações locais (FFmpeg, File Management)",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — aceita React dev server e WebView2 do Tauri (produção)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://tauri.localhost",  # Tauri v2 WebView2 no Windows
        "tauri://localhost",       # Tauri v1 (compatibilidade)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar routers
app.include_router(video.router)
app.include_router(audio.router)
app.include_router(folders.router)
app.include_router(compress.router)
app.include_router(utils.router)
app.include_router(pdf.router)
app.include_router(organize.router)
app.include_router(b3.router)
app.include_router(duplicatas.router)


import os
import glob

def _check_ffmpeg() -> bool:
    """Verifica se FFmpeg está disponível no PATH ou em pacotes WinGet."""
    # 1. Tentar PATH normal
    try:
        subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            timeout=2,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        return True
    except Exception:
        pass

    # 2. Tentar detectar via WinGet no Windows
    winget_path = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "WinGet", "Packages")
    if os.path.exists(winget_path):
        # Busca rápida por pastas que podem conter o binário
        for root, dirs, files in os.walk(winget_path):
            if "Gyan.FFmpeg" in root and "ffmpeg.exe" in files:
                return True
    
    return False


@app.get("/", response_model=HealthResponse)
def health_check():
    """Health check com status do FFmpeg."""
    return HealthResponse(
        status="ok",
        ffmpeg=_check_ffmpeg(),
        version="2.0.0",
    )


@app.websocket("/ws/progress")
async def websocket_progress(ws: WebSocket):
    """WebSocket para receber progresso das tarefas em tempo real."""
    await progress_manager.connect(ws)
    try:
        while True:
            # Mantém a conexão aberta esperando mensagens do client
            data = await ws.receive_text()
            # Client pode enviar "cancel:{task_id}" para cancelar
            if data.startswith("cancel:"):
                task_id = data.split(":", 1)[1]
                progress_manager.cancel_task(task_id)
    except WebSocketDisconnect:
        progress_manager.disconnect(ws)
