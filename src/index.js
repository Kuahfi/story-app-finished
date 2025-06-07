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
if (document.readyState === 'loading') { // Biasanya tidak perlu jika script di akhir body
    document.addEventListener('DOMContentLoaded', main);
} else {
    main(); // Langsung jalankan jika DOM sudah siap
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

async function requestNotificationPermission() {
  if ('Notification' in window && 'PushManager' in window) {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Izin notifikasi diberikan.');
      await subscribeToPushManager();
    }
  }
}

async function subscribeToPushManager() {
  const VAPID_PUBLIC_KEY = 'BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk'; // <-- Ganti ini!

  function urlBase64ToUint8Array(base64String) {
      
  }

  const registration = await navigator.serviceWorker.ready;
  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    console.log('Berhasil subscribe:', JSON.stringify(subscription));
    // Kirim object subscription ini ke server Anda jika diperlukan
  } catch (err) {
    console.error('Gagal subscribe:', err);
  }
}

window.addEventListener('load', () => {
    requestNotificationPermission();
});