import subprocess
import time
import webbrowser
import sys
import os

def main():
    print("===================================================")
    print("        Iniciando Control Pro 2.0 Web Edition      ")
    print("===================================================\n")
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    print("[1/3] Iniciando Backend (FastAPI)...")
    backend_proc = subprocess.Popen(
        ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
        cwd=os.path.join(base_dir, "backend")
    )
    
    print("[2/3] Iniciando Frontend (Vite/React)...")
    frontend_proc = subprocess.Popen(
        ["pnpm", "dev"],
        cwd=os.path.join(base_dir, "frontend"),
        shell=True
    )
    
    print("[3/3] Aguardando inicialização...")
    time.sleep(4)
    
    print("\nAbra o navegador em: http://localhost:5173")
    webbrowser.open("http://localhost:5173")
    
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
