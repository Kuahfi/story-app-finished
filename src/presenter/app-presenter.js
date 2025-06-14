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

        this.currentStream = null;
        this.selectedLocation = null;
        this.capturedPhotoFile = null;

        this.storiesMap = null;
        this.locationMap = null;
        this.locationMapMarker = null;
    }

    init() {
        this.view.bindNavigate(this.navigateTo.bind(this));
        this.view.bindHashChange(this.handleHashChange.bind(this));
        this.view.bindLoginSubmit(this.handleLoginSubmit.bind(this));
        this.view.bindRegisterSubmit(this.handleRegisterSubmit.bind(this));
        this.view.bindShowRegisterForm(this.handleShowRegisterForm.bind(this));
        this.view.bindAddStorySubmit(this.handleAddStorySubmit.bind(this));
        this.view.bindSaveStory(this.handleSaveStory.bind(this));
        this.view.bindDeleteStory(this.handleDeleteStory.bind(this));
        this.view.bindCameraActions({
            start: this.startCamera.bind(this),
            take: this.takePhoto.bind(this),
            stop: this.stopCamera.bind(this),
            handleFile: this.handlePhotoFile.bind(this),
        });
        this.view.bindLocationActions({
            getCurrent: this.getCurrentLocationForStory.bind(this),
        });

        this.updateLoginButtonView();
        const initialHash = window.location.hash.slice(1);
        this.navigateTo(initialHash || 'home');
    }

    handleHashChange(hash) {
        const newRoute = hash || this.model.getCurrentRouteFromState() || 'home';
        this.navigateTo(newRoute, true);
    }

    navigateTo(route, calledFromHashChange = false) {
        if (this.currentStream) this.stopCamera();

        if (route === 'add-story' && !this.model.isUserLoggedIn()) {
            this.view.showMessage('Anda harus login untuk mengakses halaman ini.', 'error');
            if (!calledFromHashChange) window.location.hash = 'login';
            route = 'login';
        }

        if (!calledFromHashChange) {
            window.location.hash = route;
        }
        this.model.setCurrentRouteInState(route);
        this.renderPage(route);
    }

    renderPage(route) {
        switch (route) {
            case 'home':
                const stories = this.model.getStoriesFromState();
                this.view.renderHomePage(stories, () => this.initStoriesMap());
                if (this.model.isUserLoggedIn()) {
                    this.loadStories();
                }
                break;
            case 'saved':
                this.loadSavedStories(); // Panggil fungsi baru untuk memuat dari DB
                break;
            case 'add-story':
                if (!this.model.isUserLoggedIn()) { this.navigateTo('login'); return; }
                this.view.renderAddStoryPage(() => this.initLocationMap());
                break;
            case 'login':
                if (this.model.isUserLoggedIn()) { this.navigateTo('home'); return; }
                this.view.renderLoginPage();
                break;
            default:
                this.navigateTo('home');
        }
        this.view.updateActiveNavButton(route);
        this.updateLoginButtonView();
    }

    async handleLoginSubmit(email, password) {
        const submitBtn = this.view.getLoginSubmitButton();
        this.view.disableSubmitButton(submitBtn, '⏳ Masuk...');
        try {
            const loginResult = await this.model.performLogin(email, password);
            if (loginResult && loginResult.token && typeof loginResult.name !== 'undefined') {
                this.model.setAuthState(loginResult.token, loginResult);
                this.view.showMessage(`Selamat datang, ${loginResult.name}! 👋`, 'success');
                this.updateLoginButtonView();

                // --- SUBSCRIBE PUSH NOTIFICATION SETELAH LOGIN ---
                await this._handlePushSubscription();

                await this.loadStories();
                setTimeout(() => this.navigateTo('home'), 1000);
            } else {
                console.error('[PRESENTER] Data loginResult tidak lengkap:', loginResult);
                throw new Error('Data login tidak lengkap atau tidak valid dari server.');
            }
        } catch (error) {
            console.error('[PRESENTER] Error saat login submit:', error);
            this.view.showMessage(error.message || 'Login Gagal', 'error');
        } finally {
            if (submitBtn) {
                this.view.enableSubmitButton(submitBtn, '🔓 Login');
            }
        }
    }

    async handleSaveStory(storyId) {
        // Ambil objek story lengkap dari model berdasarkan ID
        const storyToSave = this.model.getStoriesFromState().find(story => story.id === storyId);
        if (storyToSave) {
            try {
                await StoryDb.putStory(storyToSave);
                this.view.showMessage('Cerita berhasil disimpan untuk dibaca offline!', 'success');
            } catch (error) {
                console.error('Gagal menyimpan cerita:', error);
                this.view.showMessage('Gagal menyimpan cerita.', 'error');
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
            this.view.toggleRegisterForm(false);
            this.view.fillEmailOnLoginForm(email);
        } catch (error) {
            this.view.showMessage(error.message || 'Registrasi Gagal', 'error');
        } finally {
            this.view.enableSubmitButton(submitBtn, '✅ Daftar');
        }
    }

    handleShowRegisterForm() {
        this.view.toggleRegisterForm();
    }

    async handleAddStorySubmit(description) {
        const photoFile = this.capturedPhotoFile;
        const locationData = this.selectedLocation;
        const submitBtn = this.view.getAddStorySubmitButton();

        if (!description || description.length < 3) { this.view.showMessage('Deskripsi min 3 karakter!', 'error'); return; }
        if (!photoFile) { this.view.showMessage('Foto wajib ada!', 'error'); return; }
        if (photoFile.size > 1 * 1024 * 1024) { this.view.showMessage('Foto maks 1MB!', 'error'); return; }

        this.view.disableSubmitButton(submitBtn);
        try {
            await this.model.addNewStoryToServer(description, photoFile, locationData);
            this.view.showMessage('Story berhasil ditambah! 🎉', 'success');
            this.view.resetAddStoryForm();
            this.capturedPhotoFile = null;
            this.selectedLocation = null;
            this.view.updatePhotoPreview('#', true);
            this.view.updateLocationInfoOnAddStoryPage();
            if (this.locationMap && this.locationMapMarker) { this.locationMap.removeLayer(this.locationMapMarker); this.locationMapMarker = null; }

            await this.loadStories();
            setTimeout(() => this.navigateTo('home'), 1500);
        } catch (error) {
            this.view.showMessage(error.message || 'Gagal tambah story', 'error');
        } finally {
            this.view.enableSubmitButton(submitBtn, '🚀 Bagikan Story');
        }
    }

    async loadStories() {
        this.view.showLoadingStories();
        try {
            await this.model.fetchStoriesFromServer();
            const storiesForView = this.model.getStoriesFromState();
            if (this.model.getCurrentRouteFromState() === 'home') {
                this.view.renderHomePage(storiesForView, () => this.initStoriesMap());
            }
        } catch (error) {
            console.log('Network fetch failed, trying to get stories from IndexedDB.');
            this.view.showMessage('Anda sedang offline. Menampilkan data yang tersimpan.', 'info');
            const storiesFromDb = await StoryDb.getStories();
            this.model.stories = storiesFromDb;

            console.log('Gagal mengambil cerita dari server karena offline.');
            this.view.showMessage('Anda sedang offline. Buka halaman "Tersimpan" untuk melihat cerita offline.', 'info');
            this.view.renderHomePage([]); // Tampilkan halaman home kosong
        } finally {
            const storiesForView = this.model.getStoriesFromState();
            if (this.model.getCurrentRouteFromState() === 'home') {
                this.view.renderHomePage(storiesForView, () => this.initStoriesMap());
            }
        }
    }

    async loadSavedStories() {
        this.view.showLoadingStories(); // Tampilkan loading
        try {
            const savedStories = await StoryDb.getStories();
            this.view.renderSavedStoriesPage(savedStories);
        } catch (error) {
            console.error('Gagal memuat cerita tersimpan:', error);
            this.view.showMessage('Gagal memuat cerita tersimpan.', 'error');
            this.view.renderSavedStoriesPage([]); // Tampilkan halaman kosong jika error
        }
    }

    updateLoginButtonView() {
        const isLoggedIn = this.model.isUserLoggedIn();
        const userName = isLoggedIn ? this.model.getUserName() : null;
        this.view.updateLoginButtonText(
            isLoggedIn,
            userName,
            () => this.navigateTo('login'),
            () => this.logout()
        );
    }

    async handleDeleteStory(storyId) {
        try {
            await StoryDb.deleteStory(storyId);
            this.view.showMessage('Cerita berhasil dihapus.', 'success');
            
            // Panggil fungsi untuk memuat ulang halaman cerita tersimpan
            await this.loadSavedStories();
        } catch (error) {
            console.error('Gagal menghapus cerita:', error);
            this.view.showMessage('Gagal menghapus cerita.', 'error');
        }
    }

    async logout() {
        // --- UNSUBSCRIBE PUSH NOTIFICATION SEBELUM LOGOUT ---
        await this._handlePushUnsubscription();

        this.model.clearAuthState();
        this.updateLoginButtonView();
        this.navigateTo('login');
        this.view.showMessage('Anda telah logout.', 'info');
    }

    // --- PENAMBAHAN FUNGSI UNTUK PUSH NOTIFICATION ---
    _urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    async _handlePushSubscription() {
        if (!('Notification' in window) || !('PushManager' in window)) {
            console.warn('Push notification tidak didukung.');
            return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('Izin notifikasi tidak diberikan.');
            return;
        }

        const VAPID_PUBLIC_KEY = 'BCCs2eonMI-6H2ctvFaWg-UYdDv387Vno_bzUzALpB442r2lCnsHmtrx8biyPi_E-1fSGABK_Qs_GlvPoJJqxbk';
        try {
            const registration = await navigator.serviceWorker.ready;
            const existingSubscription = await registration.pushManager.getSubscription();
            if (existingSubscription) {
                console.log('Sudah ada subscription, tidak perlu subscribe ulang.');
                return;
            }

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this._urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });

            await this.model.subscribeToPush(subscription);
            this.view.showMessage('Berhasil mengaktifkan notifikasi!', 'success');
        } catch (error) {
            console.error('Gagal melakukan subscribe:', error);
            this.view.showMessage('Gagal mengaktifkan notifikasi.', 'error');
        }
    }

    async _handlePushUnsubscription() {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                await this.model.unsubscribeFromPush(subscription);
                await subscription.unsubscribe();
                console.log('Berhasil unsubscribe notifikasi.');
            }
        } catch (error) {
            console.error('Gagal melakukan unsubscribe:', error);
        }
    }
    // --- AKHIR DARI FUNGSI PUSH NOTIFICATION ---

    // Metode untuk Kamera
    handlePhotoFile(eventOrFile) {
        const file = eventOrFile.target ? eventOrFile.target.files[0] : eventOrFile;
        if (file) {
            this.capturedPhotoFile = file;
            const reader = new FileReader();
            reader.onload = (e) => this.view.updatePhotoPreview(e.target.result, false);
            reader.readAsDataURL(file);
            if (this.currentStream) this.stopCamera();
        }
    }

    async startCamera() {
        const videoElement = this.view.getCameraFeedElement();
        if (!videoElement) { console.error("Presenter: Video element not found by View"); return; }
        try {
            this.currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            videoElement.srcObject = this.currentStream;
            this.view.toggleCameraControls(true, true);
            this.view.updatePhotoPreview('#', true);
            this.capturedPhotoFile = null;
            this.view.resetPhotoInput();
        } catch (error) {
            this.view.showMessage('Kamera tidak bisa diakses. Beri izin atau pilih file.', 'error');
            this.view.clickPhotoInput();
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
            this.stopCamera();
        }, 'image/jpeg', 0.85);
    }

    stopCamera() {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }
        this.view.toggleCameraControls(false, false);
    }

    // Metode untuk Lokasi & Peta
    getCurrentLocationForStory() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude: lat, longitude: lon } = position.coords;
                    this.selectedLocation = { lat, lon };
                    this.view.updateLocationInfoOnAddStoryPage(`<p>📍 Lokasi saat ini: ${lat.toFixed(4)}, ${lon.toFixed(4)}</p>`);
                    if (this.locationMap) {
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
        setTimeout(() => {
            const mapId = 'stories-map';
            if (!this.view.doesElementExist(mapId)) {
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
        }, 150);
    }

    initLocationMap() {
        setTimeout(() => {
            const mapId = 'location-map';
            if (!this.view.doesElementExist(mapId)) {
                console.warn(`Presenter: Elemen map '${mapId}' tidak ditemukan oleh View.`);
                return;
            }
            if (this.locationMap) this.locationMap.remove();

            this.locationMap = L.map(mapId).setView([-6.2088, 106.8456], 10);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM' }).addTo(this.locationMap);

            if (this.locationMapMarker) {
                this.locationMap.removeLayer(this.locationMapMarker);
                this.locationMapMarker = null;
            }

            this.locationMap.on('click', (e) => {
                const { lat, lng: lon } = e.latlng;
                this.selectedLocation = { lat, lon };
                if (this.locationMapMarker) this.locationMap.removeLayer(this.locationMapMarker);
                this.locationMapMarker = L.marker([lat, lon]).addTo(this.locationMap);
                this.view.updateLocationInfoOnAddStoryPage(`<p>📍 Lokasi dipilih: ${lat.toFixed(4)}, ${lon.toFixed(4)}</p>`);
            });
        }, 150);
    }
}