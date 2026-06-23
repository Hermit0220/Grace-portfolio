// ============================================================
//  LOGIN SYSTEM — Session, Roles & Inactivity
// ============================================================

const SESSION_KEY   = 'grace_portfolio_session';
const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutes

// Admin credentials (client-side only — this is a portfolio site)
const ADMIN_USER = 'Grace2006';
const ADMIN_PASS = '2006';

/**
 * Returns the saved session object, or null if missing / expired.
 */
function getValidSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const session = JSON.parse(raw);
        const age = Date.now() - (session.lastActivity || 0);
        if (age > INACTIVITY_MS) {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
        return session;
    } catch { return null; }
}

/** Save / refresh the session timestamp. */
function saveSession(role) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
        role,
        lastActivity: Date.now()
    }));
}

/** Wipe the session and show the login overlay. */
function logout() {
    localStorage.removeItem(SESSION_KEY);
    showLoginOverlay();
}

/** Hide the overlay with a smooth fade then remove from layout. */
function hideLoginOverlay() {
    const overlay = document.getElementById('login-overlay');
    overlay.classList.add('hidden');
    setTimeout(() => { overlay.style.display = 'none'; }, 500);
}

function showLoginOverlay() {
    const overlay = document.getElementById('login-overlay');
    overlay.style.display = 'flex';
    // Force reflow so the CSS transition fires
    overlay.offsetHeight;
    overlay.classList.remove('hidden');
}

/**
 * Apply role-based UI permissions.
 * Admin  → all controls visible.
 * Guest  → upload controls + remove buttons hidden.
 */
function applyRole(role) {
    const isAdmin = role === 'admin';
    document.querySelectorAll('.upload-content').forEach(el => {
        el.style.display = isAdmin ? '' : 'none';
    });
    document.querySelectorAll('.remove-btn').forEach(el => {
        el.style.display = isAdmin ? '' : 'none';
    });
    document.querySelectorAll('.polaroid-save-btn').forEach(el => {
        // Only hide save btns for guests; admins keep whatever state they're in
        if (!isAdmin) el.style.display = 'none';
    });
    // Disable click-to-upload for guests
    document.querySelectorAll('.photo-upload-container').forEach(container => {
        container.dataset.adminOnly = isAdmin ? 'true' : 'false';
    });

    // All admin-only elements (page 4 save, page 5 save, add track)
    document.querySelectorAll('.admin-only-element').forEach(el => {
        el.style.display = isAdmin ? '' : 'none';
    });

    // Page 4 note textarea readonly
    const p4Textarea = document.getElementById('p4-note-textarea');
    if (p4Textarea) {
        if (isAdmin) p4Textarea.removeAttribute('readonly');
        else p4Textarea.setAttribute('readonly', 'true');
    }

    // Page 5 textareas readonly for guests
    ['p5-song-title', 'p5-song-details'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (isAdmin) el.removeAttribute('readonly');
            else el.setAttribute('readonly', 'true');
        }
    });
}

// --- Inactivity timer ---
let inactivityTimer = null;

function resetInactivityTimer() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return; // not logged in — ignore
    try {
        const session = JSON.parse(raw);
        session.lastActivity = Date.now();
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch {}

    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        logout();
    }, INACTIVITY_MS);
}

// Track user activity on the page
['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(evt => {
    document.addEventListener(evt, resetInactivityTimer, { passive: true });
});

// --- Boot: check session on every page load ---
(function bootLoginSystem() {
    const session = getValidSession();
    if (session) {
        // Valid session — skip login, apply role, restart inactivity timer
        hideLoginOverlay();
        // Wait for DOM photo containers to exist before applying role
        document.addEventListener('DOMContentLoaded', () => applyRole(session.role));
        resetInactivityTimer();
    } else {
        showLoginOverlay();
    }
})();

// --- Login form submission ---
document.addEventListener('DOMContentLoaded', () => {
    const form       = document.getElementById('login-form');
    const usernameEl = document.getElementById('login-username');
    const passwordEl = document.getElementById('login-password');
    const errorEl    = document.getElementById('login-error');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = usernameEl.value.trim();
        const password = passwordEl.value;

        // Require at least something in both fields
        if (!username || !password) {
            showError('Please fill in both fields.');
            return;
        }

        let role;
        if (username === ADMIN_USER && password === ADMIN_PASS) {
            role = 'admin';
        } else {
            // Any other non-empty credentials → guest
            role = 'guest';
        }

        // Save session & dismiss overlay
        saveSession(role);
        applyRole(role);
        hideLoginOverlay();
        resetInactivityTimer();

        // Clear fields for security
        usernameEl.value = '';
        passwordEl.value = '';
        errorEl.style.display = 'none';
    });

    function showError(msg) {
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
        // Re-trigger shake animation
        errorEl.style.animation = 'none';
        errorEl.offsetHeight;
        errorEl.style.animation = '';
    }
});

document.addEventListener('DOMContentLoaded', () => {

    const parallaxElements = document.querySelectorAll('.parallax');

    window.addEventListener('scroll', () => {
        const scrolled = window.scrollY;

        parallaxElements.forEach((el) => {
            const speed = el.getAttribute('data-speed');
            // Move the elements up or down slightly based on scroll position and their data-speed
            el.style.transform = `translateY(${scrolled * speed}px)`;
        });
    });
    // Fetch existing photos on load and restore them to their exact slots
    fetch('/api/photos')
        .then(res => res.json())
        .then(photos => {
            if (Array.isArray(photos)) {
                photos.forEach(photo => {
                    // Use data-slot attribute for exact, reliable slot matching
                    const container = document.querySelector(`[data-slot="${photo.slotId}"]`);
                    if (container) {
                        const uploadContent = container.querySelector('.upload-content');
                        const uploadedImg = container.querySelector('.uploaded-img');
                        const removeBtn = container.querySelector('.remove-btn');
                        const saveBtn = container.querySelector('.polaroid-save-btn');

                        if (uploadedImg) {
                            uploadedImg.src = photo.imageData;
                            uploadedImg.style.display = 'block';
                        }
                        if (uploadContent) uploadContent.style.display = 'none';
                        if (removeBtn) removeBtn.style.display = 'block';
                        if (saveBtn) saveBtn.style.display = 'none';
                    }
                });
            }
        })
        .catch(err => console.error('Error fetching photos:', err));

    // Fetch existing Page 4 note on load
    const p4Textarea = document.getElementById('p4-note-textarea');
    const p4SaveBtn  = document.getElementById('p4-note-save-btn');

    if (p4Textarea) {
        fetch('/api/note')
            .then(res => res.json())
            .then(data => {
                if (data.url) {
                    // Cache-buster prevents stale Cloudinary CDN responses
                    fetch(data.url + '?_cb=' + Date.now())
                        .then(r => r.text())
                        .then(text => {
                            // If saved text is empty, leave the textarea blank (shows placeholder)
                            p4Textarea.value = text.trim();
                        })
                        .catch(err => console.error('Error reading note text:', err));
                }
            })
            .catch(err => console.error('Error fetching note URL:', err));
    }

    // Handle Page 4 Note Save
    if (p4SaveBtn && p4Textarea) {
        p4SaveBtn.addEventListener('click', () => {
            const textToSave = p4Textarea.value; // preserve whitespace for saving
            p4SaveBtn.textContent = 'Saving...';
            p4SaveBtn.disabled = true;

            fetch('/api/note', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textToSave })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    p4SaveBtn.textContent = 'Saved!';
                    // If the user cleared everything, reset textarea so placeholder reappears
                    if (textToSave.trim() === '') {
                        p4Textarea.value = '';
                    }
                    setTimeout(() => {
                        p4SaveBtn.textContent = 'Save';
                        p4SaveBtn.disabled = false;
                    }, 2000);
                } else {
                    throw new Error(data.error || 'Unknown error');
                }
            })
            .catch(err => {
                console.error('Error saving note:', err);
                p4SaveBtn.textContent = 'Error';
                setTimeout(() => {
                    p4SaveBtn.textContent = 'Save';
                    p4SaveBtn.disabled = false;
                }, 2000);
            });
        });
    }

    // Photo upload logic
    const uploadContainers = document.querySelectorAll('.photo-upload-container');

    uploadContainers.forEach(container => {
        let currentSelectedFile = null;
        const fileInput = container.querySelector('.file-input');
        const uploadContent = container.querySelector('.upload-content');
        const uploadedImg = container.querySelector('.uploaded-img');
        const removeBtn = container.querySelector('.remove-btn');
        const saveBtn = container.querySelector('.polaroid-save-btn');

        // Clicking the container triggers the hidden file input (admin only)
        container.addEventListener('click', () => {
            if (container.dataset.adminOnly === 'false') return; // guests: no-op
            fileInput.click();
        });

        // Handle remove button click
        if (removeBtn) {
            removeBtn.addEventListener('click', (event) => {
                event.stopPropagation();

                const slotId = container.dataset.slot; // use data-slot for reliable ID
                
                // Update UI instantly
                uploadedImg.style.display = 'none';
                uploadedImg.src = '';
                if (removeBtn) removeBtn.style.display = 'none';
                if (saveBtn) saveBtn.style.display = 'none';
                uploadContent.style.display = 'flex';
                fileInput.value = '';
                currentSelectedFile = null;

                if (slotId) {
                    fetch(`/api/photos/${slotId}`, {
                        method: 'DELETE'
                    }).catch(err => console.error('Error removing photo:', err));
                }
            });
        }

        // Handle file selection
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                currentSelectedFile = file;
                const reader = new FileReader();
                reader.onload = (e) => {
                    const base64String = e.target.result;

                    // Hide the add icon/text and show the image locally first for snappy UI
                    uploadContent.style.display = 'none';
                    uploadedImg.src = base64String;
                    uploadedImg.style.display = 'block';
                    if (removeBtn) removeBtn.style.display = 'block';
                    if (saveBtn) {
                        saveBtn.style.display = 'block';
                        saveBtn.textContent = 'Save';
                        saveBtn.disabled = false;
                    }
                };
                reader.readAsDataURL(file);
            }
        });

        // Handle save button click
        if (saveBtn) {
            saveBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                if (!currentSelectedFile) return;

                const slotId = container.dataset.slot; // use data-slot for reliable ID
                if (slotId) {
                    saveBtn.textContent = 'Saving...';
                    saveBtn.disabled = true;

                    const formData = new FormData();
                    formData.append('slotId', slotId);
                    formData.append('file', currentSelectedFile);

                    fetch('/api/upload', {
                        method: 'POST',
                        body: formData
                    })
                        .then(res => res.json())
                        .then(data => {
                            if (data.error) throw new Error(data.error);
                            saveBtn.textContent = 'Saved!';
                            setTimeout(() => {
                                saveBtn.style.display = 'none';
                            }, 2000);
                            currentSelectedFile = null;
                        })
                        .catch(err => {
                            console.error('Error saving photo:', err);
                            saveBtn.textContent = 'Error';
                            saveBtn.disabled = false;
                        });
                }
            });
        }
    });

    // --- Page 5 Disc Conveyor Logic ---
    const p5Discs = [
        document.querySelector('.p5-disc-1'),
        document.querySelector('.p5-disc-2'),
        document.querySelector('.p5-disc-3'),
        document.querySelector('.p5-disc-4')
    ];

    // Initial states: Disc 1 at Bottom(1), Disc 2 at Center(2), Disc 3 at Top(3), Disc 4 at Offscreen Bottom(0)
    let discStates = [1, 2, 3, 0];

    // Make advanceDiscs globally accessible so audio player can call it
    window.advanceDiscs = function () {
        if (!p5Discs[0]) return;

        p5Discs.forEach((disc, i) => {
            let currentState = discStates[i];
            let nextState = currentState + 1;

            if (nextState === 4) {
                // Move to Offscreen Top (state 4)
                disc.classList.remove(`p5-pos-${currentState}`);
                disc.classList.add('p5-pos-4');

                // After transition finishes (1.5s), teleport to Offscreen Bottom (state 0)
                setTimeout(() => {
                    disc.classList.add('no-transition'); // Disable transition
                    disc.classList.remove('p5-pos-4');
                    disc.classList.add('p5-pos-0');

                    // Force reflow
                    void disc.offsetWidth;

                    disc.classList.remove('no-transition'); // Re-enable transition
                    discStates[i] = 0;
                }, 1500);
            } else if (nextState < 4) {
                disc.classList.remove(`p5-pos-${currentState}`);
                disc.classList.add(`p5-pos-${nextState}`);
                discStates[i] = nextState;
            }
        });
    };

    if (p5Discs[0]) {
        // Apply initial classes
        p5Discs.forEach((disc, i) => {
            disc.classList.add(`p5-pos-${discStates[i]}`);
        });
    }

    // ── Music Player + Per-Track Notes ──────────────────────────────────────
    const audioElement = document.getElementById('audio-element');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const playIcon     = document.getElementById('play-icon');
    const pauseIcon    = document.getElementById('pause-icon');
    const audioSlider  = document.getElementById('audio-slider');
    const sliderFill   = document.getElementById('slider-fill');
    const nextTrackBtn = document.getElementById('next-track-btn');
    const p5NextBtn    = document.getElementById('p5-next-btn');

    // Default tracks (local audio folder)
    const tracks = [
        "audio/Sade - Smooth Operator (Lyrics).mp3",
        "audio/The Neighbourhood - Reflections (Official Audio).mp3",
        "audio/Michael Jackson - Human Nature (Audio).mp3",
        "audio/Sade - Like a Tattoo (Audio).mp3",
        "audio/BTS - Let Me Know (방탄소년단 - Let Me Know) [Color Coded LyricsHanRomEng가사].mp4",
        "audio/Still With You.mp3",
        "audio/Flatline.mp3",
        "audio/Excitement.mp3",
        "audio/Guns N' Roses - November Rain (Lyrics).mp3",
        "audio/Jhené Aiko - stranger (Audio).mp3",
        "audio/Salvatore.mp3"
    ];
    let currentTrackIndex = 0;

    // ── Per-Track Notes ──────────────────────────────────────────────────────
    const DEFAULT_NOTES = [
        { heading: "SMOOTH OPERATOR",  body: "Cool, unhurried. Like velvet on a slow evening — the kind of song that doesn't rush anything." },
        { heading: "REFLECTIONS",      body: "A quiet ache wrapped in reverb. Every listen feels like staring at something beautiful you can't hold onto." },
        { heading: "HUMAN NATURE",     body: "Tender and golden. MJ at his most gentle — curiosity turned into music." },
        { heading: "LIKE A TATTOO",    body: "Some feelings don't fade. Sade sings like she's lived every word of this." },
        { heading: "LET ME KNOW",      body: "Soft BTS harmonies over aching questions. A song that sits quietly inside you." },
        { heading: "STILL WITH YOU",   body: "JK's longing poured into sound. Still feels present even in its absence." },
        { heading: "FLATLINE",         body: "Numbness in melody form. The kind of song you play when words aren't enough." },
        { heading: "EXCITEMENT",       body: "An upswing — warmth and motion in one. Exactly what the title promises." },
        { heading: "NOVEMBER RAIN",    body: "Nine minutes of build and release. Grief dressed up as a love song." },
        { heading: "STRANGER",         body: "Dreamy and cool. Jhene floats through this one like she's not even trying." },
        { heading: "SALVATORE",        body: "Lana at her most cinematic. Longing for something too beautiful to name." }
    ];

    let trackNotes = [];
    let p5Baseline = { heading: '', body: '' };
    let toastTimer  = null;

    const p5TitleEl     = document.getElementById('p5-song-title');
    const p5DetailsEl   = document.getElementById('p5-song-details');
    const p5NoteSaveBtn = document.getElementById('p5-note-save-btn');
    const p5ErrorToast  = document.getElementById('p5-error-toast');

    function displayTrackNote(index) {
        const note = trackNotes[index] || DEFAULT_NOTES[index] || { heading: '', body: '' };
        if (p5TitleEl)   p5TitleEl.value   = note.heading || '';
        if (p5DetailsEl) p5DetailsEl.value = note.body    || '';
        p5Baseline = { heading: note.heading || '', body: note.body || '' };
    }

    function showP5Error(msg) {
        if (!p5ErrorToast) return;
        p5ErrorToast.textContent = msg;
        p5ErrorToast.classList.add('visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => p5ErrorToast.classList.remove('visible'), 3000);
    }

    function loadTrackNotes() {
        fetch('/api/track-notes')
            .then(res => res.json())
            .then(notes => {
                trackNotes = Array.isArray(notes) && notes.length > 0 ? notes : [...DEFAULT_NOTES];
                displayTrackNote(currentTrackIndex);
            })
            .catch(() => {
                trackNotes = [...DEFAULT_NOTES];
                displayTrackNote(currentTrackIndex);
            });
    }
    loadTrackNotes();

    // Save Note button
    if (p5NoteSaveBtn) {
        p5NoteSaveBtn.addEventListener('click', () => {
            const heading = (p5TitleEl   ? p5TitleEl.value.trim()   : '');
            const body    = (p5DetailsEl ? p5DetailsEl.value.trim() : '');

            // Dirty check — nothing changed?
            if (heading === p5Baseline.heading.trim() && body === p5Baseline.body.trim()) {
                showP5Error('Please write something first!');
                return;
            }

            // Update in-memory notes array
            if (!trackNotes[currentTrackIndex]) trackNotes[currentTrackIndex] = {};
            trackNotes[currentTrackIndex].heading = heading;
            trackNotes[currentTrackIndex].body    = body;

            p5NoteSaveBtn.textContent = 'Saving...';
            p5NoteSaveBtn.disabled    = true;

            fetch('/api/track-notes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: trackNotes })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    p5NoteSaveBtn.textContent = 'Saved!';
                    p5Baseline = { heading, body }; // Update baseline so next click is a new dirty-check
                    setTimeout(() => {
                        p5NoteSaveBtn.textContent = 'Save';
                        p5NoteSaveBtn.disabled    = false;
                    }, 2000);
                } else {
                    throw new Error(data.error || 'Unknown error');
                }
            })
            .catch(err => {
                console.error('Error saving track note:', err);
                p5NoteSaveBtn.textContent = 'Error';
                setTimeout(() => {
                    p5NoteSaveBtn.textContent = 'Save';
                    p5NoteSaveBtn.disabled    = false;
                }, 2000);
            });
        });
    }

    // Add Track + Save Track (admin only, bottom-left)
    const p5AddBtn    = document.getElementById('p5-add-btn');
    const p5FileInput = document.getElementById('p5-file-input');
    const p5SaveBtn   = document.getElementById('p5-save-btn');

    if (p5AddBtn && p5FileInput) {
        p5AddBtn.addEventListener('click', () => p5FileInput.click());

        p5FileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                p5SaveBtn.style.display = '';  // Show Save Track button
            }
        });

        if (p5SaveBtn) {
            p5SaveBtn.addEventListener('click', () => {
                const file = p5FileInput.files[0];
                if (!file) return;

                p5SaveBtn.textContent = 'Saving...';
                p5SaveBtn.disabled    = true;

                const formData = new FormData();
                formData.append('file', file);

                fetch('/api/sign-upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: file.name })
                })
                .then(res => res.json())
                .then(signData => {
                    if (signData.error) throw new Error(signData.error);

                    const fd = new FormData();
                    fd.append('file', file);
                    fd.append('api_key', signData.apiKey);
                    fd.append('timestamp', signData.timestamp);
                    fd.append('signature', signData.signature);
                    fd.append('folder', signData.folder);
                    fd.append('public_id', signData.public_id);

                    // Upload directly to Cloudinary bypassing Vercel limits
                    return fetch(`https://api.cloudinary.com/v1_1/${signData.cloudName}/video/upload`, {
                        method: 'POST',
                        body: fd
                    }).then(res => res.json()).then(uploadData => ({
                        uploadData,
                        originalName: file.name
                    }));
                })
                .then(({ uploadData, originalName }) => {
                    if (uploadData.error) {
                        throw new Error(uploadData.error.message || 'Upload failed');
                    }
                    
                    // Append to live track list
                    tracks.push(uploadData.secure_url);
                    // Create default note entry for the new track
                    const rawName = originalName.replace(/\.[^/.]+$/, '');
                    trackNotes.push({
                        heading: rawName.toUpperCase().substring(0, 28),
                        body: ''
                    });

                    p5SaveBtn.textContent = 'Saved!';
                    setTimeout(() => {
                        p5SaveBtn.style.display = 'none';
                        p5SaveBtn.textContent   = 'Save Track';
                        p5SaveBtn.disabled      = false;
                        p5FileInput.value       = '';
                    }, 2000);
                })
                .catch(err => {
                    console.error('Add track error:', err);
                        p5SaveBtn.textContent = 'Error';
                        p5SaveBtn.disabled    = false;
                        setTimeout(() => { p5SaveBtn.textContent = 'Save Track'; }, 4000);
                    });
            });
        }
    }

    // ── Audio player ─────────────────────────────────────────────────────────
    if (audioElement) {
        audioElement.src = tracks[currentTrackIndex];

        audioElement.volume = 1.0;
        if (audioSlider) audioSlider.value = 100;
        if (sliderFill)  sliderFill.style.width = '100%';

        function togglePlay() {
            if (audioElement.paused) {
                audioElement.play();
                if (playIcon)  playIcon.style.display  = 'none';
                if (pauseIcon) pauseIcon.style.display = 'block';
            } else {
                audioElement.pause();
                if (playIcon)  playIcon.style.display  = 'block';
                if (pauseIcon) pauseIcon.style.display = 'none';
            }
        }

        window.playNextTrack = function () {
            currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
            audioElement.src  = tracks[currentTrackIndex];
            audioElement.play();
            if (playIcon)  playIcon.style.display  = 'none';
            if (pauseIcon) pauseIcon.style.display = 'block';

            // Update paper text for new track
            displayTrackNote(currentTrackIndex);

            if (window.advanceDiscs) window.advanceDiscs();
        };

        if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlay);
        if (nextTrackBtn) nextTrackBtn.addEventListener('click', window.playNextTrack);
        if (p5NextBtn) {
            p5NextBtn.addEventListener('click', function() {
                if (this.disabled) return;
                this.disabled = true;
                window.playNextTrack();
                setTimeout(() => { this.disabled = false; }, 2000);
            });
        }

        if (audioSlider) {
            audioSlider.addEventListener('input', (e) => {
                audioElement.volume       = e.target.value / 100;
                sliderFill.style.width    = `${e.target.value}%`;
            });
        }

        audioElement.addEventListener('ended', window.playNextTrack);
    }
});

