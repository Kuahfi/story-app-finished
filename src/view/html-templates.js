// src/view/html-templates.js

export default class HtmlTemplates {
    static home(stories) {
        const storiesHtml = stories.length > 0
            ? stories.map(story => this.storyCard(story)).join('')
            : '<div class="loading">Tidak ada cerita untuk ditampilkan. Login untuk melihat atau tambah cerita baru.</div>';

        return `
            <section class="page-section" id="home-page">
                <h2>📖 Cerita Terbaru dari Komunitas</h2>
                <p>Temukan inspirasi dari cerita-cerita menarik komunitas Dicoding.</p>
                <div class="story-grid">${storiesHtml}</div>
                <div id="stories-map" class="map-placeholder"></div>
            </section>
        `;
    }

    static storyCard(story) {
        if (!story || !story.createdAt || !story.photoUrl || !story.name) {
            console.warn("Data story tidak lengkap:", story);
            return '<article class="story-card story-card--error"><p>Data cerita tidak lengkap.</p></article>';
        }
        const date = new Date(story.createdAt).toLocaleDateString('id-ID', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        // Pastikan alt text selalu ada dan bermakna
        const altText = story.description ? `Foto cerita ${story.name}: ${story.description.substring(0, 50)}...` : `Foto cerita dari ${story.name}`;

        return `
            <article class="story-card">
                <img src="${story.photoUrl}" alt="${altText}" class="story-image" loading="lazy">
                <div class="story-card-content">
                    <h3 class="story-name">👤 ${story.name}</h3>
                    <p class="story-description">${story.description || 'Tidak ada deskripsi.'}</p>
                    <time class="story-date" datetime="${story.createdAt}">📅 ${date}</time>
                    ${story.lat && story.lon ?
                        `<div class="story-location">📍 ${parseFloat(story.lat).toFixed(4)}, ${parseFloat(story.lon).toFixed(4)}</div>` : ''
                    }
                </div>
            </article>
        `;
    }

    static addStory() {
        return `
            <section class="page-section" id="add-story-page">
                <h2>➕ Tambah Story Baru</h2>
                <p>Bagikan momen inspiratif Anda dengan komunitas.</p>
                <form class="form-container" id="add-story-form" novalidate>
                    <div class="form-group">
                        <label for="story-description">Deskripsi Story *</label>
                        <textarea id="story-description" name="story-description" placeholder="Ceritakan pengalaman inspiratif Anda..." required aria-describedby="desc-help"></textarea>
                        <small id="desc-help">Minimal 3 karakter.</small>
                    </div>
                    <div class="form-group">
                        <label for="photo-input">Foto Story *</label>
                        <input type="file" id="photo-input" name="photo-input" accept="image/*" aria-describedby="photo-help" required>
                        <small id="photo-help">Max 1MB (format JPG, PNG).</small>
                    </div>
                    <div class="camera-container">
                        <button type="button" class="btn" id="start-camera-btn">📷 Buka Kamera</button>
                        <video id="camera-feed" class="hidden" autoplay playsinline></video>
                        <canvas id="photo-canvas" class="hidden" aria-hidden="true"></canvas>
                        <div id="camera-controls" class="camera-controls hidden">
                            <button type="button" class="btn" id="take-photo-btn">📸 Ambil Foto</button>
                            <button type="button" class="btn" id="stop-camera-btn">❌ Tutup Kamera</button>
                        </div>
                        <img id="photo-preview" src="#" alt="Pratinjau foto yang akan diunggah" class="hidden story-image" style="margin-top: 1rem;"/>
                    </div>
                    <div class="form-group">
                        <label for="location-map">Lokasi Story (Opsional)</label>
                        <p>Klik peta atau gunakan lokasi saat ini.</p>
                        <button type="button" class="btn" id="use-current-location-btn" style="margin-bottom: 10px;">📍 Gunakan Lokasi Saat Ini</button>
                        <div id="location-map" class="map-placeholder" aria-label="Peta untuk memilih lokasi cerita"></div>
                        <div class="location-info" id="location-info-display">
                            <p>📍 Belum ada lokasi dipilih.</p>
                            <small>Klik peta atau tombol di atas untuk menambahkan lokasi.</small>
                        </div>
                    </div>
                    <button type="submit" class="btn" id="submit-story-btn">🚀 Bagikan Story</button>
                </form>
            </section>
        `;
    }

    static login() {
        return `
            <section class="page-section" id="login-page">
                <h2>🔐 Login</h2>
                <p>Masuk ke akun Anda untuk mengakses semua fitur.</p>
                <form class="form-container" id="login-form" novalidate>
                    <div class="form-group">
                        <label for="login-email">Email *</label>
                        <input type="email" id="login-email" name="login-email" placeholder="contoh@email.com" required autocomplete="email">
                    </div>
                    <div class="form-group">
                        <label for="login-password">Password *</label>
                        <input type="password" id="login-password" name="login-password" placeholder="Minimal 8 karakter" required minlength="8" autocomplete="current-password">
                    </div>
                    <button type="submit" class="btn" id="login-submit-btn">🔓 Login</button>
                </form>
                <div style="text-align: center; margin: 2rem 0;">
                    <p>Belum punya akun? <button type="button" class="btn" id="show-register-form-btn">📝 Daftar</button></p>
                </div>
                <div class="form-container hidden" id="register-form-container">
                    <h3>📝 Daftar Akun Baru</h3>
                    <form id="register-form" novalidate>
                        <div class="form-group">
                            <label for="register-name">Nama Lengkap *</label>
                            <input type="text" id="register-name" name="register-name" placeholder="Nama Anda" required autocomplete="name">
                        </div>
                        <div class="form-group">
                            <label for="register-email">Email *</label>
                            <input type="email" id="register-email" name="register-email" placeholder="email@anda.com" required autocomplete="email">
                        </div>
                        <div class="form-group">
                            <label for="register-password">Password *</label>
                            <input type="password" id="register-password" name="register-password" placeholder="Min 8 karakter" required minlength="8" autocomplete="new-password">
                        </div>
                        <button type="submit" class="btn" id="register-submit-btn">✅ Daftar</button>
                    </form>
                </div>
            </section>
        `;
    }
}