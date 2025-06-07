// src/model/story-app-model.js

import StoryDb from '../utils/db-helper.js';

class ApiServiceInternal {
    constructor(baseUrl) {
        this.baseUrl = baseUrl || 'https://story-api.dicoding.dev/v1';
    }

    async _fetchWithAuth(url, options = {}) {
        const token = sessionStorage.getItem('token'); // Ambil token langsung dari session storage
        const headers = { ...options.headers };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status} - ${response.statusText}` }));
            throw new Error(errorData.message || 'Request API gagal');
        }
        return response.json();
    }
    
    async _fetchWithoutAuth(url, options = {}) {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status} - ${response.statusText}` }));
            throw new Error(errorData.message || 'Request API gagal');
        }
        return response.json();
    }


    register(name, email, password) {
        return this._fetchWithoutAuth(`${this.baseUrl}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password }),
        });
    }

    login(email, password) {
        return this._fetchWithoutAuth(`${this.baseUrl}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
    }

    getStories() {
        // getStories memerlukan token, jadi pakai _fetchWithAuth
        return this._fetchWithAuth(`${this.baseUrl}/stories?location=1&size=20&page=1`);
    }

    addStory(formData) {
        // addStory memerlukan token
        return this._fetchWithAuth(`${this.baseUrl}/stories`, {
            method: 'POST',
            // FormData tidak perlu Content-Type, browser yg atur
            body: formData,
        });
    }
}


export default class StoryAppModel {
    constructor() {
        this.api = new ApiServiceInternal(); // Internal API service
        this.token = sessionStorage.getItem('token') || null;
        this.user = JSON.parse(sessionStorage.getItem('user') || 'null');
        this.stories = [];
        this.currentRoute = 'home'; // Default route
    }

    // --- Metode untuk State Management ---
    setAuthState(token, user) {
        this.token = token;
        this.user = user;
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('user', JSON.stringify(user));
    }

    clearAuthState() {
        this.token = null;
        this.user = null;
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
    }

    isUserLoggedIn() {
        return !!this.token;
    }

    getUserName() {
        return this.user ? this.user.name : null;
    }

    getCurrentRouteFromState() {
        return this.currentRoute;
    }

    setCurrentRouteInState(route) {
        this.currentRoute = route;
    }

    getStoriesFromState() {
        return [...this.stories]; // Kembalikan salinan agar tidak dimutasi dari luar
    }

    // --- Metode untuk Data & API ---
    async performLogin(email, password) {
        const response = await this.api.login(email, password);
        if (response.error) throw new Error(response.message || 'Login gagal dari API');
        return response.loginResult; // Kembalikan loginResult ke Presenter
    }

    async performRegister(name, email, password) {
        const response = await this.api.register(name, email, password);
        if (response.error) throw new Error(response.message || 'Registrasi gagal dari API');
        return response; // Kembalikan seluruh response ke Presenter
    }

    async fetchStoriesFromServer() {
        if (!this.isUserLoggedIn()) { // Hanya fetch jika login
            this.stories = [];
            // console.log("Model: Tidak login, stories dikosongkan.");
            return;
        }
        try {
            const response = await this.api.getStories(); // ApiServiceInternal akan handle token
            if (!response.error || (response.error && response.message === "Stories not found")) {
                this.stories = response.listStory || [];
                await StoryDb.putAllStories(this.stories);
            } else {
                this.stories = [];
                throw new Error(response.message || 'Gagal memuat cerita dari API (Model)');
            }
        } catch (error) {
            this.stories = []; // Kosongkan jika error
            // console.error("Model: Error fetching stories:", error);
            throw error; // Lempar error ke Presenter
        }
    }

    async addNewStoryToServer(description, photoFile, locationData) {
        // Token akan dihandle oleh ApiServiceInternal
        const formData = new FormData();
        formData.append('description', description);
        formData.append('photo', photoFile);
        if (locationData) {
            formData.append('lat', locationData.lat);
            formData.append('lon', locationData.lon);
        }
        const response = await this.api.addStory(formData);
        if (response.error) throw new Error(response.message || 'Gagal tambah story dari API (Model)');
        // Setelah berhasil, Presenter akan panggil fetchStoriesFromServer lagi untuk update list
        return response;
    }
}