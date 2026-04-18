import subprocess
import time
import webbrowser
import sys
import os
import glob
import tempfile
import signal
import atexit

PID_FILE = os.path.join(tempfile.gettempdir(), "control_pro.pids")

_procs = []

def _cleanup():
    """Remove o arquivo de PIDs ao encerrar."""
    try:
        os.remove(PID_FILE)
    except FileNotFoundError:
        pass

def _write_pids(*pids):
    with open(PID_FILE, "w") as f:
        f.write("\n".join(str(p) for p in pids if p))

def main():
    print("===================================================")
    print("        Iniciando Control Pro 2.0 Web Edition      ")
    print("===================================================\n")

    base_dir = os.path.dirname(os.path.abspath(__file__))

    # Tentar localizar FFmpeg instalado via winget se não estiver no PATH
    winget_path = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "WinGet", "Packages")
    if os.path.exists(winget_path):
        # Busca recursiva por ffmpeg.exe dentro de pastas que começam com Gyan.FFmpeg
        for root, dirs, files in os.walk(winget_path):
            if "Gyan.FFmpeg" in root and "ffmpeg.exe" in files:
                bin_path = root
                print(f"[#] FFmpeg detectado em: {bin_path}")
                os.environ["PATH"] = bin_path + os.pathsep + os.environ["PATH"]
                break

    print("[1/3] Iniciando Backend (FastAPI)...")
    python_venv = os.path.join(base_dir, "backend", ".venv", "Scripts", "python.exe")
    backend_proc = subprocess.Popen(
        [python_venv, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010"],
        cwd=os.path.join(base_dir, "backend")
    )
    _procs.append(backend_proc)

    print("[2/3] Iniciando Frontend (Vite/React)...")
    frontend_proc = subprocess.Popen(
        ["cmd", "/c", "pnpm", "dev"],
        cwd=os.path.join(base_dir, "frontend"),
    )
    _procs.append(frontend_proc)

    # Salva os PIDs para que fechar.ps1 possa matar a árvore inteira
    _write_pids(os.getpid(), backend_proc.pid, frontend_proc.pid)
    atexit.register(_cleanup)

    print("[3/3] Aguardando inicialização...")
    time.sleep(4)

    print("\nAbra o navegador em: http://localhost:5174")
    webbrowser.open("http://localhost:5174")

    print("\n[!] Servidores em execução. Para DESLIGAR, feche esta janela ou pressione Ctrl+C.\n")

    try:
        backend_proc.wait()
        frontend_proc.wait()
    except KeyboardInterrupt:
        print("\nEncerrando servidores...")
        backend_proc.terminate()
        frontend_proc.terminate()
        sys.exit(0)

if __name__ == "__main__":
    main()
