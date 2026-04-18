"""
Entry point para o sidecar Tauri.
Este arquivo é usado pelo PyInstaller para empacotar o backend FastAPI.
"""

import multiprocessing
import os
import sys

# freeze_support DEVE ser a primeira coisa chamada (antes de qualquer import pesado)
if __name__ == "__main__":
    multiprocessing.freeze_support()

# Quando empacotado pelo PyInstaller, ajusta o sys.path e ativa log em arquivo
if getattr(sys, "frozen", False):
    bundle_dir = sys._MEIPASS  # type: ignore[attr-defined]
    sys.path.insert(0, bundle_dir)
    os.chdir(bundle_dir)

    # Log em arquivo para debug (fica em %TEMP%\control_pro_backend.log)
    import tempfile
    log_path = os.path.join(tempfile.gettempdir(), "control_pro_backend.log")
    log_file = open(log_path, "w", buffering=1, encoding="utf-8")
    sys.stdout = log_file
    sys.stderr = log_file
    print(f"[startup] bundle_dir={bundle_dir}")
    print(f"[startup] sys.path={sys.path[:3]}")

# Importações depois dos ajustes de path
from main import app as fastapi_app  # noqa: E402
import uvicorn  # noqa: E402


def main() -> None:
    print("[main] iniciando uvicorn na porta 8000")
    try:
        uvicorn.run(
            fastapi_app,
            host="127.0.0.1",
            port=8010,
            log_level="info",
            reload=False,
            workers=1,
        )
    except Exception as e:
        print(f"[main] ERRO FATAL: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
