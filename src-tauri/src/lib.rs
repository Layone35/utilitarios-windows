use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::{process::CommandChild, ShellExt};

struct Backend(Mutex<Option<CommandChild>>);

/// Aguarda o backend responder no /health com polling (max 30s).
/// PyInstaller one-file precisa extrair para %TEMP% antes de iniciar — pode demorar.
fn wait_for_backend(max_secs: u64) -> bool {
    let url = "http://127.0.0.1:8000/";
    let step = std::time::Duration::from_millis(500);
    let max = std::time::Duration::from_secs(max_secs);
    let mut elapsed = std::time::Duration::ZERO;

    while elapsed < max {
        if let Ok(resp) = ureq::get(url).call() {
            if resp.status() == 200 {
                return true;
            }
        }
        std::thread::sleep(step);
        elapsed += step;
    }
    false
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(Backend(Mutex::new(None)))
        .setup(|app| {
            // Inicia o backend FastAPI como sidecar
            let sidecar = app
                .shell()
                .sidecar("backend")
                .expect("Sidecar 'backend' não encontrado em src-tauri/binaries/");

            let (_rx, child) = sidecar.spawn().expect("Falha ao iniciar backend FastAPI");
            *app.state::<Backend>().0.lock().unwrap() = Some(child);

            // Aguarda o uvicorn responder (polling a cada 500ms, max 30s)
            // Necessário porque PyInstaller one-file extrai arquivos para %TEMP% antes de iniciar
            wait_for_backend(30);

            Ok(())
        })
        .on_window_event(|window, event| {
            // Encerra o backend quando a janela for fechada
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let app = window.app_handle();
                // extrai o child do guard antes de soltar o borrow
                let child = app
                    .state::<Backend>()
                    .0
                    .lock()
                    .ok()
                    .and_then(|mut g| g.take());
                if let Some(child) = child {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("Erro ao executar Control Pro");
}
