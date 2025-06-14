// src/index.js

// 1. Impor semua komponen inti MVP dan CSS utama
import StoryAppModel from './model/story-app-model.js';
import MainView from './view/main-view.js';
import AppPresenter from './presenter/app-presenter.js';
import './css/style.css'; // Impor CSS utama aplikasi agar Webpack memprosesnya

// Fungsi utama untuk menjalankan aplikasi
function main() {
    console.log('Aplikasi dimulai...');

    // 2. Buat instance dari Model, View, dan Presenter
    const model = new StoryAppModel();
    const view = new MainView();
    // 3. "Suntikkan" (inject) Model dan View ke Presenter
    const presenter = new AppPresenter(model, view);

    // 4. Mulai aplikasi dengan menginisialisasi Presenter
    presenter.init();

    console.log('Presenter telah diinisialisasi.');
}

// Pastikan DOM sudah siap sebelum menjalankan fungsi main
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}

// 5. Registrasi Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker: Terdaftar sukses! Cakupan:', registration.scope);
            })
            .catch(registrationError => {
                console.log('Service Worker: Registrasi gagal:', registrationError);
            });
    });
} else {
    console.log('Service Worker tidak didukung di browser ini.');
}

// Logika untuk meminta izin notifikasi dan subscribe sekarang ditangani di dalam AppPresenter.
// Tidak ada lagi kode notifikasi di sini untuk menjaga kebersihan arsitektur.