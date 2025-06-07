// src/view/main-view.js
import HtmlTemplates from './html-templates.js'; // Impor template HTML kita

export default class MainView {
    constructor() {
        this.mainContentElement = document.getElementById('main-content');
        this.loginBtnElement = document.getElementById('login-btn'); // Tombol Login/Logout utama
        this.navButtons = {
            home: document.getElementById('home-btn'),
            addStory: document.getElementById('add-story-btn'),
        };
        this.skipLink = document.querySelector('.skip-link');

        if (!this.mainContentElement) {
            throw new Error("Fatal Error: Elemen #main-content tidak ditemukan. Aplikasi tidak bisa berjalan.");
        }
        if (!this.loginBtnElement) {
            console.warn("Elemen #login-btn tidak ditemukan. Fungsi login/logout mungkin terganggu.");
        }

        this._setupSkipToContent();
        this._setupYearInFooter();
    }

    // --- Metode Setup Awal View ---
    _setupSkipToContent() {
        if (this.skipLink && this.mainContentElement) {
            this.skipLink.addEventListener("click", (event) => {
                event.preventDefault();
                this.skipLink.blur();
                this.mainContentElement.focus(); 
            });
        }
    }

    _setupYearInFooter() {
        const currentYearElement = document.getElementById('current-year');
        if (currentYearElement) {
            currentYearElement.textContent = new Date().getFullYear();
        }
    }

    bindNavigate(handler) { // handler akan => presenter.navigateTo(route)
        this.navButtons.home?.addEventListener('click', () => handler('home'));
        this.navButtons.addStory?.addEventListener('click', () => handler('add-story'));
    }

    bindHashChange(handler) { // handler akan => presenter.handleHashChange(newHash)
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.slice(1);
            handler(hash);
        });
    }

    bindLoginSubmit(handler) { this._loginSubmitHandler = handler; }
    bindRegisterSubmit(handler) { this._registerSubmitHandler = handler; }
    bindShowRegisterForm(handler) { this._showRegisterFormHandler = handler; }
    bindAddStorySubmit(handler) { this._addStorySubmitHandler = handler; }
    bindCameraActions(handlers) { this._cameraHandlers = handlers; }
    bindLocationActions(handlers) { this._locationHandlers = handlers; }


    // --- Metode untuk Merender Halaman Utama ---
    _displayPage(htmlContent, afterRenderCallback) {
        if (!this.mainContentElement) return;

        const doRender = () => {
            this.mainContentElement.innerHTML = htmlContent;
            if (afterRenderCallback) afterRenderCallback();
        };

        if (document.startViewTransition) {
            document.startViewTransition(doRender);
        } else {
            this.mainContentElement.classList.add('transitioning'); // Efek fallback
            setTimeout(() => {
                doRender();
                this.mainContentElement.classList.remove('transitioning');
            }, 50);
        }
    }

    renderHomePage(stories, initMapCallback) {
        this._displayPage(HtmlTemplates.home(stories), initMapCallback);
    }

    renderAddStoryPage(initLocationMapCallback) {
        this._displayPage(HtmlTemplates.addStory(), () => {
            if (initLocationMapCallback) initLocationMapCallback(); // Panggil callback presenter untuk init map

            // Pasang event listener spesifik untuk form ini
            const form = document.getElementById('add-story-form');
            form?.addEventListener('submit', (e) => {
                e.preventDefault();
                if (this._addStorySubmitHandler) {
                    const description = form.querySelector('#story-description').value;
                    this._addStorySubmitHandler(description);
                }
            });

            if (this._cameraHandlers) {
                document.getElementById('start-camera-btn')?.addEventListener('click', this._cameraHandlers.start);
                document.getElementById('take-photo-btn')?.addEventListener('click', this._cameraHandlers.take);
                document.getElementById('stop-camera-btn')?.addEventListener('click', this._cameraHandlers.stop);
                document.getElementById('photo-input')?.addEventListener('change', this._cameraHandlers.handleFile);
            }
            if (this._locationHandlers) {
                document.getElementById('use-current-location-btn')?.addEventListener('click', this._locationHandlers.getCurrent);
            }
        });
    }

    renderLoginPage() {
        this._displayPage(HtmlTemplates.login(), () => {
            const loginForm = document.getElementById('login-form');
            loginForm?.addEventListener('submit', (e) => {
                e.preventDefault();
                if (this._loginSubmitHandler) {
                    const email = loginForm.querySelector('#login-email').value;
                    const password = loginForm.querySelector('#login-password').value;
                    this._loginSubmitHandler(email, password);
                }
            });

            const registerForm = document.getElementById('register-form');
            registerForm?.addEventListener('submit', (e) => {
                e.preventDefault();
                if (this._registerSubmitHandler) {
                    const name = registerForm.querySelector('#register-name').value;
                    const email = registerForm.querySelector('#register-email').value;
                    const password = registerForm.querySelector('#register-password').value;
                    this._registerSubmitHandler(name, email, password);
                }
            });

            document.getElementById('show-register-form-btn')?.addEventListener('click', () => {
                if (this._showRegisterFormHandler) this._showRegisterFormHandler();
            });
        });
    }

    // --- Metode untuk Update UI Spesifik ---
    updateLoginButtonText(isLoggedIn, userName, loginClickHandler, logoutClickHandler) {
        if (!this.loginBtnElement) return;
        
        const newLoginBtn = this.loginBtnElement.cloneNode(true);
        this.loginBtnElement.parentNode.replaceChild(newLoginBtn, this.loginBtnElement);
        this.loginBtnElement = newLoginBtn; // Update referensi

        if (isLoggedIn && userName) {
            this.loginBtnElement.innerHTML = `👤 ${userName} (Logout)`;
            this.loginBtnElement.onclick = logoutClickHandler; // Handler dari Presenter
        } else {
            this.loginBtnElement.innerHTML = '🔐 Login';
            this.loginBtnElement.onclick = loginClickHandler; // Handler dari Presenter
        }
    }

    updateActiveNavButton(currentRoute) {
        // Nonaktifkan semua tombol navigasi utama
        Object.values(this.navButtons).forEach(btn => btn?.classList.remove('active'));
        
        if (this.loginBtnElement) {
            if (currentRoute === 'login' /* && !isUserLoggedIn (cek ini di Presenter) */) {
                this.loginBtnElement.classList.add('active');
            } else {
                this.loginBtnElement.classList.remove('active');
            }
        }

        const routeBase = currentRoute.split('-')[0]; // Misal 'add-story' jadi 'add'
        if (this.navButtons[routeBase]) {
            this.navButtons[routeBase].classList.add('active');
        }
    }

    showMessage(message, type = 'info') {
        if (!this.mainContentElement) return;
        this.mainContentElement.querySelectorAll('.message-notification').forEach(el => el.remove());

        const messageDiv = document.createElement('div');
        messageDiv.className = `message-notification message-${type}`; // Pakai kelas CSS
        messageDiv.textContent = message;
        messageDiv.setAttribute('role', 'alert');
        messageDiv.setAttribute('aria-live', 'polite');
        
        this.mainContentElement.insertBefore(messageDiv, this.mainContentElement.firstChild);
        setTimeout(() => messageDiv.remove(), 5000);
    }
    
    // -- Metode Update UI untuk Form Add Story --
    updatePhotoPreview(src, hide) {
        const el = document.getElementById('photo-preview');
        if (el) { el.src = src; el.classList.toggle('hidden', hide); }
    }

    updateLocationInfoOnAddStoryPage(htmlContent = `<p>📍 Belum ada lokasi dipilih.</p><small>Klik peta atau tombol di atas.</small>`) {
        const el = document.getElementById('location-info-display'); // Ganti ID jika perlu
        if (el) el.innerHTML = htmlContent;
    }

    toggleCameraControls(showVideo, showControls) {
        document.getElementById('camera-feed')?.classList.toggle('hidden', !showVideo);
        document.getElementById('camera-controls')?.classList.toggle('hidden', !showControls);
    }
    
    resetPhotoInput() {
        const photoInput = document.getElementById('photo-input');
        if (photoInput) photoInput.value = null; // Reset input file
    }

    clickPhotoInput() { // Dipanggil Presenter jika kamera gagal & mau fallback ke file
        document.getElementById('photo-input')?.click();
    }

    // -- Metode Update UI untuk Form Login/Register --
    resetFormById(formId) {
        const form = document.getElementById(formId);
        form?.reset();
    }
    resetAddStoryForm() { this.resetFormById('add-story-form'); }
    resetRegisterForm() { this.resetFormById('register-form'); }


    toggleRegisterForm(forceVisible) {
        const el = document.getElementById('register-form-container');
        if (el) {
            if (typeof forceVisible === 'boolean') {
                el.classList.toggle('hidden', !forceVisible);
            } else {
                el.classList.toggle('hidden');
            }
        }
    }

    fillEmailOnLoginForm(email) {
        const emailField = document.getElementById('login-email'); // Pastikan ID-nya benar
        if (emailField) emailField.value = email;
        document.getElementById('login-password')?.focus();
    }

    // -- Metode Getter untuk Elemen (digunakan Presenter untuk status, bukan manipulasi langsung) --
    getCameraFeedElement() { return document.getElementById('camera-feed'); }
    getPhotoCanvasElement() { return document.getElementById('photo-canvas'); }
    getAddStoryFormElement() { return document.getElementById('add-story-form'); } // Untuk Presenter reset via View
    getLoginSubmitButton() { return document.getElementById('login-form')?.querySelector('button[type="submit"]');}
    getRegisterSubmitButton() { return document.getElementById('register-form')?.querySelector('button[type="submit"]');}
    getAddStorySubmitButton() { return document.getElementById('add-story-form')?.querySelector('button[type="submit"]');}

    disableSubmitButton(button, text = 'Memproses...') { 
        if(button){ button.disabled = true; button.textContent = text;}
    }
    enableSubmitButton(button, originalText) { 
        if(button){button.disabled = false; button.textContent = originalText;}
    }

    // Untuk Presenter mengecek apakah elemen map sudah ada di DOM sebelum init Leaflet
    doesElementExist(elementId) {
        return !!document.getElementById(elementId);
    }

    showLoadingStories() {
        const storyGrid = this.mainContentElement.querySelector('.story-grid');
        const loadingDiv = this.mainContentElement.querySelector('.loading');
        if (storyGrid) {
            storyGrid.innerHTML = '<div class="loading">Memuat cerita...</div>';
        } else if (loadingDiv) {
            loadingDiv.innerHTML = 'Memuat cerita...';
        } else {
            // Jika tidak ada keduanya, mungkin halaman home belum dirender,
            // atau view home perlu dirender ulang dengan pesan loading
            this.mainContentElement.innerHTML = HtmlTemplates.home([]); // Render home kosong
            const newLoadingDiv = this.mainContentElement.querySelector('.loading');
            if (newLoadingDiv) newLoadingDiv.innerHTML = 'Memuat cerita...';
        }
    }
}