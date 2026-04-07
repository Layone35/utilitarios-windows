// Impede abertura de console extra no Windows em release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    control_pro_lib::run()
}
