// src/model/story-app-model.js

import StoryDb from '../utils/db-helper.js';

class ApiServiceInternal {
    constructor(baseUrl) {
        this.baseUrl = baseUrl || 'https://story-api.dicoding.dev/v1';
    }

    async _fetchWithAuth(url, options = {}) {
        const token = sessionStorage.getItem('token');
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
        const response = await fetch(url, {
            ...options,
            headers: { 'Content-Type': 'application/json', ...options.headers },
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: `HTTP error! status: ${response.status} - ${response.statusText}` }));
            throw new Error(errorData.message || 'Request API gagal');
        }
        return response.json();
    }


    register(name, email, password) {
        return this._fetchWithoutAuth(`${this.baseUrl}/register`, {
            method: 'POST',
            body: JSON.stringify({ name, email, password }),
        });
    }

    login(email, password) {
        return this._fetchWithoutAuth(`${this.baseUrl}/login`, {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    }

    getStories() {
        return this._fetchWithAuth(`${this.baseUrl}/stories?location=1&size=20&page=1`);
    }

    addStory(formData) {
        return this._fetchWithAuth(`${this.baseUrl}/stories`, {
            method: 'POST',
            body: formData,
        });
    }

    // --- FUNGSI BARU UNTUK PUSH NOTIFICATION ---
    subscribe(subscription) {
        const { endpoint, keys: { p256dh, auth } } = subscription.toJSON();
        return this._fetchWithAuth(`${this.baseUrl}/notifications/subscribe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ endpoint, keys: { p256dh, auth } }),
        });
    }

    unsubscribe(subscription) {
        const { endpoint } = subscription;
        return this._fetchWithAuth(`${this.baseUrl}/notifications/subscribe`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ endpoint }),
        });
    }
}


export default class StoryAppModel {
    constructor() {
        this.api = new ApiServiceInternal();
        this.token = sessionStorage.getItem('token') || null;
        this.user = JSON.parse(sessionStorage.getItem('user') || 'null');
        this.stories = [];
        this.currentRoute = 'home';
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
        return [...this.stories];
    }

    // --- Metode untuk Data & API ---
    async performLogin(email, password) {
        const response = await this.api.login(email, password);
        if (response.error) throw new Error(response.message || 'Login gagal dari API');
        return response.loginResult;
    }

    async performRegister(name, email, password) {
        const response = await this.api.register(name, email, password);
        if (response.error) throw new Error(response.message || 'Registrasi gagal dari API');
        return response;
    }

    async fetchStoriesFromServer() {
        if (!this.isUserLoggedIn()) {
            this.stories = [];
            return;
        }
        try {
            const response = await this.api.getStories();
            if (!response.error || (response.error && response.message === "Stories not found")) {
                this.stories = response.listStory || [];
            } else {
                this.stories = [];
                throw new Error(response.message || 'Gagal memuat cerita dari API (Model)');
            }
        } catch (error) {
            this.stories = [];
            throw error;
        }
    }

    async addNewStoryToServer(description, photoFile, locationData) {
        const formData = new FormData();
        formData.append('description', description);
        formData.append('photo', photoFile);
        if (locationData) {
            formData.append('lat', locationData.lat);
            formData.append('lon', locationData.lon);
        }
        const response = await this.api.addStory(formData);
        if (response.error) throw new Error(response.message || 'Gagal tambah story dari API (Model)');
        return response;
    }

    // --- METODE BARU UNTUK PUSH NOTIFICATION ---
    async subscribeToPush(subscription) {
        try {
            const response = await this.api.subscribe(subscription);
            if (response.error) throw new Error(response.message);
            console.log('Model: Berhasil subscribe notifikasi.');
            return response;
        } catch (error) {
            console.error('Model: Gagal subscribe notifikasi:', error);
            throw error;
        }
    }

    async unsubscribeFromPush(subscription) {
        try {
            const response = await this.api.unsubscribe(subscription);
            if (response.error) throw new Error(response.message);
            console.log('Model: Berhasil unsubscribe notifikasi.');
            return response;
        } catch (error) {
            console.error('Model: Gagal unsubscribe notifikasi:', error);
        }
    }
}