// src/presenter/app-presenter.js

import L from 'leaflet';
import StoryDb from '../utils/db-helper.js';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.webpack.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet/dist/leaflet.css';

export default class AppPresenter {
    constructor(model, view) {
        this.model = model; // Instance dari StoryAppModel
        this.view = view;   // Instance dari MainView

        // State UI sementara yang dikelola Presenter (tidak masuk ke data aplikasi utama di Model)
        this.currentStream = null;
        this.selectedLocation = null;   // { lat, lon }
        this.capturedPhotoFile = null;  // File object

        // Instance peta Leaflet (dikelola Presenter)
        this.storiesMap = null;
        this.locationMap = null;
        this.locationMapMarker = null; // Marker untuk peta pilih lokasi
    }

    init() {
        // 1. Ikat (bind) event dari View ke handler di Presenter
        this.view.bindNavigate(this.navigateTo.bind(this));
        this.view.bindHashChange(this.handleHashChange.bind(this));
        this.view.bindLoginSubmit(this.handleLoginSubmit.bind(this));
        this.view.bindRegisterSubmit(this.handleRegisterSubmit.bind(this));
        this.view.bindShowRegisterForm(this.handleShowRegisterForm.bind(this));
        this.view.bindAddStorySubmit(this.handleAddStorySubmit.bind(this));
        this.view.bindCameraActions({
            start: this.startCamera.bind(this),
            take: this.takePhoto.bind(this),
            stop: this.stopCamera.bind(this),
            handleFile: this.handlePhotoFile.bind(this),
        });
        this.view.bindLocationActions({
            getCurrent: this.getCurrentLocationForStory.bind(this),
            // initMap untuk add story akan dipanggil saat view.renderAddStoryPage
        });

        // 2. Update tampilan awal tombol login
        this.updateLoginButtonView();

        // 3. Inisialisasi routing berdasarkan hash URL awal
        const initialHash = window.location.hash.slice(1);
        this.navigateTo(initialHash || 'home'); // Default ke 'home' jika tidak ada hash
    }

    // --- Handler untuk Navigasi & Routing ---
    handleHashChange(hash) {
        // Model menyimpan currentRoute, jadi kita bisa ambil dari sana jika hash kosong
        const newRoute = hash || this.model.getCurrentRouteFromState() || 'home';
        this.navigateTo(newRoute, true); // true menandakan ini dipanggil dari event hashchange
    }

    navigateTo(route, calledFromHashChange = false) {
        if (this.currentStream) this.stopCamera();

        if (route === 'add-story' && !this.model.isUserLoggedIn()) {
            this.view.showMessage('Anda harus login untuk mengakses halaman ini.', 'error');
            if (!calledFromHashChange) window.location.hash = 'login';
            route = 'login';
        }

        if (!calledFromHashChange) {
            window.location.hash = route; // Presenter yang mengontrol URL hash
        }
        this.model.setCurrentRouteInState(route); // Update state rute di Model
        this.renderPage(route); // Panggil metode render Presenter
    }

    renderPage(route) {
        switch (route) {
            case 'home':
                const stories = this.model.getStoriesFromState();
                this.view.renderHomePage(stories, () => this.initStoriesMap());
                // Hanya load stories jika user login, atau jika API guest diimplementasikan
                if (this.model.isUserLoggedIn()) {
                    this.loadStories();
                }
                break;
            case 'add-story':
                if (!this.model.isUserLoggedIn()) { this.navigateTo('login'); return; }
                this.view.renderAddStoryPage(() => this.initLocationMap()); // Callback untuk init map lokasi
                break;
            case 'login':
                if (this.model.isUserLoggedIn()) { this.navigateTo('home'); return; }
                this.view.renderLoginPage();
                break;
            default:
                this.navigateTo('home');
        }
        this.view.updateActiveNavButton(route); // Minta View update tombol navigasi aktif
        this.updateLoginButtonView(); // Pastikan tombol login/logout juga selalu update
    }

    // --- Handler untuk Aksi User dari View ---
    async handleLoginSubmit(email, password) {
        const submitBtn = this.view.getLoginSubmitButton();
        this.view.disableSubmitButton(submitBtn, '⏳ Masuk...');
        try {
            // loginResult dari model adalah objek { userId, name, token }
            const loginResult = await this.model.performLogin(email, password);
            console.log('[PRESENTER] loginResult dari Model:', loginResult); // DEBUG

            // Pastikan loginResult dan properti pentingnya ada
            if (loginResult && loginResult.token && typeof loginResult.name !== 'undefined') {
                // BENAR: Kirim seluruh objek loginResult sebagai detail user ke Model,
                // karena loginResult itu sendiri yang punya properti .name, .userId, .token.
                this.model.setAuthState(loginResult.token, loginResult);

                // BENAR: Akses .name langsung dari loginResult
                this.view.showMessage(`Selamat datang, ${loginResult.name}! 👋`, 'success');

                this.updateLoginButtonView(); // Ini akan manggil model.getUserName()
                await this.loadStories();
                setTimeout(() => this.navigateTo('home'), 1000);
            } else {
                // Ini jaga-jaga jika performLogin tidak throw error tapi hasilnya aneh
                console.error('[PRESENTER] Data loginResult tidak lengkap:', loginResult);
                throw new Error('Data login tidak lengkap atau tidak valid dari server.');
            }
        } catch (error) {
            console.error('[PRESENTER] Error saat login submit:', error);
            this.view.showMessage(error.message || 'Login Gagal', 'error');
        } finally {
            if (submitBtn) { // Pastikan submitBtn masih ada sebelum di-enable
                this.view.enableSubmitButton(submitBtn, '🔓 Login');
            }
        }
    }

    async handleRegisterSubmit(name, email, password) {
        const submitBtn = this.view.getRegisterSubmitButton();
        this.view.disableSubmitButton(submitBtn, '⏳ Mendaftar...');
        try {
            await this.model.performRegister(name, email, password);
            this.view.showMessage('Registrasi sukses! Silakan login. ✅', 'success');
            this.view.resetRegisterForm();
            this.view.toggleRegisterForm(false); // false untuk menyembunyikan
            this.view.fillEmailOnLoginForm(email);
        } catch (error) {
            this.view.showMessage(error.message || 'Registrasi Gagal', 'error');
        } finally {
            this.view.enableSubmitButton(submitBtn, '✅ Daftar');
        }
    }

    handleShowRegisterForm() {
        this.view.toggleRegisterForm(); // Minta View untuk toggle tampilan form register
    }

    async handleAddStorySubmit(description) {
        const photoFile = this.capturedPhotoFile; // Ambil dari state internal Presenter
        const locationData = this.selectedLocation; // Ambil dari state internal Presenter
        const submitBtn = this.view.getAddStorySubmitButton();

        // Validasi dasar di Presenter
        if (!description || description.length < 3) { this.view.showMessage('Deskripsi min 3 karakter!', 'error'); return; }
        if (!photoFile) { this.view.showMessage('Foto wajib ada!', 'error'); return; }
        if (photoFile.size > 1 * 1024 * 1024) { this.view.showMessage('Foto maks 1MB!', 'error'); return; }

        this.view.disableSubmitButton(submitBtn);
        try {
            await this.model.addNewStoryToServer(description, photoFile, locationData);
            this.view.showMessage('Story berhasil ditambah! 🎉', 'success');
            this.view.resetAddStoryForm();
            // Reset state internal Presenter setelah berhasil
            this.capturedPhotoFile = null;
            this.selectedLocation = null;
            this.view.updatePhotoPreview('#', true);
            this.view.updateLocationInfoOnAddStoryPage(); // Reset info lokasi di view
            if (this.locationMap && this.locationMapMarker) { this.locationMap.removeLayer(this.locationMapMarker); this.locationMapMarker = null; }


            await this.loadStories();
            setTimeout(() => this.navigateTo('home'), 1500);
        } catch (error) {
            this.view.showMessage(error.message || 'Gagal tambah story', 'error');
        } finally {
            this.view.enableSubmitButton(submitBtn, '🚀 Bagikan Story');
        }
    }

    // --- Logika Bisnis & Data (Interaksi dengan Model) ---
    async loadStories() {
        this.view.showLoadingStories(); // Minta View tampilkan loading
        try {
            await this.model.fetchStoriesFromServer(); // Minta Model ambil data
            const storiesForView = this.model.getStoriesFromState(); // Ambil data terbaru dari Model
            if (this.model.getCurrentRouteFromState() === 'home') { // Hanya update view jika masih di home
                this.view.renderHomePage(storiesForView, () => this.initStoriesMap());
            }
        } catch (error) {
            console.log('Network fetch failed, trying to get stories from IndexedDB.');
            this.view.showMessage('Anda sedang offline. Menampilkan data yang tersimpan.', 'info');
            const storiesFromDb = await StoryDb.getStories();
            this.model.stories = storiesFromDb;
        } finally {
            const storiesForView = this.model.getStoriesFromState();
            if (this.model.getCurrentRouteFromState() === 'home') {
                this.view.renderHomePage(storiesForView, () => this.initStoriesMap());
            }
        }
    }

    updateLoginButtonView() { // Nama lebih deskriptif
        const isLoggedIn = this.model.isUserLoggedIn();
        const userName = isLoggedIn ? this.model.getUserName() : null;
        this.view.updateLoginButtonText(
            isLoggedIn,
            userName,
            () => this.navigateTo('login'),
            () => this.logout()
        );
    }

    logout() {
        this.model.clearAuthState();
        this.updateLoginButtonView();
        this.navigateTo('login');
        this.view.showMessage('Anda telah logout.', 'info');
    }

    // --- Metode untuk Kamera (State internal di Presenter, interaksi DOM via View) ---
    handlePhotoFile(eventOrFile) { // Bisa menerima event atau langsung file object
        const file = eventOrFile.target ? eventOrFile.target.files[0] : eventOrFile;
        if (file) {
            this.capturedPhotoFile = file;
            const reader = new FileReader();
            reader.onload = (e) => this.view.updatePhotoPreview(e.target.result, false);
            reader.readAsDataURL(file);
            if (this.currentStream) this.stopCamera(); // Logika tetap di Presenter
        }
    }

    async startCamera() {
        const videoElement = this.view.getCameraFeedElement();
        if (!videoElement) { console.error("Presenter: Video element not found by View"); return; }
        try {
            this.currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            videoElement.srcObject = this.currentStream; // Presenter set srcObject ke elemen yg disediakan View
            this.view.toggleCameraControls(true, true);  // Perintah View
            this.view.updatePhotoPreview('#', true);     // Perintah View
            this.capturedPhotoFile = null;               // Reset state Presenter
            this.view.resetPhotoInput();                 // Perintah View
        } catch (error) {
            this.view.showMessage('Kamera tidak bisa diakses. Beri izin atau pilih file.', 'error');
            this.view.clickPhotoInput(); // Perintah View
        }
    }

    takePhoto() {
        const videoElement = this.view.getCameraFeedElement();
        const canvasElement = this.view.getPhotoCanvasElement();
        if (!videoElement || !canvasElement) { console.error("Presenter: Video/Canvas element not found"); return; }

        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        canvasElement.getContext('2d').drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
        canvasElement.toBlob((blob) => {
            if (blob) {
                this.capturedPhotoFile = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
                this.view.updatePhotoPreview(URL.createObjectURL(this.capturedPhotoFile), false);
                this.view.showMessage('Foto berhasil diambil!', 'success');
            } else {
                this.view.showMessage('Gagal ambil foto dari kamera.', 'error');
            }
            this.stopCamera(); // Logika Presenter
        }, 'image/jpeg', 0.85);
    }

    stopCamera() {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }
        this.view.toggleCameraControls(false, false); // Perintah View
    }

    // --- Metode untuk Lokasi & Peta (State internal di Presenter, interaksi DOM/Peta via View/Langsung) ---
    getCurrentLocationForStory() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude: lat, longitude: lon } = position.coords;
                    this.selectedLocation = { lat, lon }; // Update state Presenter
                    this.view.updateLocationInfoOnAddStoryPage(`<p>📍 Lokasi saat ini: ${lat.toFixed(4)}, ${lon.toFixed(4)}</p>`);
                    if (this.locationMap) { // locationMap adalah instance Leaflet di Presenter
                        this.locationMap.setView([lat, lon], 13);
                        if (this.locationMapMarker) this.locationMap.removeLayer(this.locationMapMarker);
                        this.locationMapMarker = L.marker([lat, lon]).addTo(this.locationMap).bindPopup('Posisi Anda').openPopup();
                    }
                    this.view.showMessage('Lokasi saat ini didapatkan!', 'success');
                },
                (error) => this.view.showMessage(`Gagal dapat lokasi: ${error.message}.`, 'error')
            );
        } else {
            this.view.showMessage('Geolocation tidak didukung.', 'error');
        }
    }

    initStoriesMap() {
        setTimeout(() => { // setTimeout untuk memastikan DOM sudah siap setelah render view
            const mapId = 'stories-map';
            if (!this.view.doesElementExist(mapId)) { // Tanya View apakah elemennya ada
                console.warn(`Presenter: Elemen map '${mapId}' tidak ditemukan oleh View.`);
                return;
            }
            if (this.storiesMap) this.storiesMap.remove();

            let viewCoords = [-2.548926, 118.0148634]; let zoomLevel = 5;
            const storiesWithLoc = this.model.getStoriesFromState().filter(s => s.lat && s.lon);
            if (storiesWithLoc.length > 0) {
                viewCoords = [storiesWithLoc[0].lat, storiesWithLoc[0].lon]; zoomLevel = 7;
            }
            this.storiesMap = L.map(mapId).setView(viewCoords, zoomLevel);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(this.storiesMap);
            storiesWithLoc.forEach(story => {
                L.marker([story.lat, story.lon]).addTo(this.storiesMap)
                    .bindPopup(`<b>${story.name}</b><br><img src="${story.photoUrl}" alt="Foto cerita ${story.name}" width="100">`);
            });
        }, 150); // Delay kecil untuk render DOM
    }

    initLocationMap() { // Dipanggil sebagai callback oleh View setelah renderAddStoryPage
        setTimeout(() => {
            const mapId = 'location-map';
            if (!this.view.doesElementExist(mapId)) {
                console.warn(`Presenter: Elemen map '${mapId}' tidak ditemukan oleh View.`);
                return;
            }
            if (this.locationMap) this.locationMap.remove();

            this.locationMap = L.map(mapId).setView([-6.2088, 106.8456], 10); // Default Jakarta
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM' }).addTo(this.locationMap);

            if (this.locationMapMarker) { // Hapus marker lama jika ada
                this.locationMap.removeLayer(this.locationMapMarker);
                this.locationMapMarker = null;
            }

            this.locationMap.on('click', (e) => { // Presenter handle event dari instance map
                const { lat, lng: lon } = e.latlng;
                this.selectedLocation = { lat, lon }; // Update state internal Presenter
                if (this.locationMapMarker) this.locationMap.removeLayer(this.locationMapMarker);
                this.locationMapMarker = L.marker([lat, lon]).addTo(this.locationMap);
                this.view.updateLocationInfoOnAddStoryPage(`<p>📍 Lokasi dipilih: ${lat.toFixed(4)}, ${lon.toFixed(4)}</p>`); // Perintah View
            });
        }, 150);
    }
}