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

    // Refresh Remove Track button visibility (depends on role + track type)
    if (window.updateRemoveTrackBtn) window.updateRemoveTrackBtn();
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

    // Shared animation lock — prevents rapid calls from corrupting disc states.
    // At most ONE pending animation is remembered; extras are discarded.
    let _discAnimLocked  = false;
    let _discAnimPending = null; // 'forward' | 'reverse' | null

    function _runDiscAnim(direction) {
        _discAnimLocked = true;

        p5Discs.forEach((disc, i) => {
            let state = discStates[i];

            if (direction === 'forward') {
                let next = state + 1;
                if (state === 4) return; // disc still in transit — leave it alone

                if (next === 4) {
                    // Exit upward
                    disc.classList.remove(`p5-pos-${state}`);
                    disc.classList.add('p5-pos-4');
                    discStates[i] = 4; // mark IN-TRANSIT immediately so rapid calls skip it

                    setTimeout(() => {
                        disc.classList.add('no-transition');
                        disc.classList.remove('p5-pos-4');
                        disc.classList.add('p5-pos-0');
                        void disc.offsetWidth;
                        disc.classList.remove('no-transition');
                        discStates[i] = 0;
                    }, 1500);
                } else {
                    disc.classList.remove(`p5-pos-${state}`);
                    disc.classList.add(`p5-pos-${next}`);
                    discStates[i] = next;
                }

            } else { // 'reverse'
                if (state === 4) return; // disc in transit — leave it alone

                if (state === 0) {
                    // Teleport to offscreen top, then slide down to pos-3
                    disc.classList.add('no-transition');
                    disc.classList.remove('p5-pos-0');
                    disc.classList.add('p5-pos-4');
                    void disc.offsetWidth;
                    disc.classList.remove('no-transition');
                    disc.classList.remove('p5-pos-4');
                    disc.classList.add('p5-pos-3');
                    discStates[i] = 3;
                } else {
                    let prev = state - 1;
                    disc.classList.remove(`p5-pos-${state}`);
                    disc.classList.add(`p5-pos-${prev}`);
                    discStates[i] = prev;
                }
            }
        });

        // Release lock after the CSS transition completes; process any queued animation
        setTimeout(() => {
            _discAnimLocked = false;
            const pending   = _discAnimPending;
            _discAnimPending = null;
            if (pending) _runDiscAnim(pending);
        }, 1500);
    }

    window.advanceDiscs = function () {
        if (!p5Discs[0]) return;
        if (_discAnimLocked) { _discAnimPending = 'forward'; return; }
        _runDiscAnim('forward');
    };

    if (p5Discs[0]) {
        p5Discs.forEach((disc, i) => disc.classList.add(`p5-pos-${discStates[i]}`));
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
    const p5PrevBtn    = document.getElementById('p5-prev-btn');

    // All tracks come from Cloudinary — nothing is hardcoded.
    // Tracks are added via 'Add Track' and stored in User/notes/track-list on Cloudinary.
    const DEFAULT_TRACKS = [];

    let tracks    = [];  // URL-only array for <audio>
    let trackMeta = [];  // full {url, name, noteId} array
    let currentTrackIndex = 0;
    let isUploading = false;


    // No default notes — notes are saved per-track to Cloudinary by the admin.


    // Per-track note cache — lazy loaded on demand. undefined = not fetched yet.
    let trackNotes = [];
    let p5Baseline = { heading: '', body: '' };
    let toastTimer = null;

    const p5TitleEl        = document.getElementById('p5-song-title');
    const p5DetailsEl      = document.getElementById('p5-song-details');
    const p5NoteSaveBtn    = document.getElementById('p5-note-save-btn');
    const p5ErrorToast     = document.getElementById('p5-error-toast');
    const p5ManageTracksBtn = document.getElementById('p5-manage-tracks-btn');

    // Track List popup elements
    const trackListOverlay  = document.getElementById('track-list-overlay');
    const trackListBody     = document.getElementById('track-list-body');
    const trackListCloseBtn = document.getElementById('track-list-close');

    // Confirmation popup elements
    const trackConfirmOverlay = document.getElementById('track-confirm-overlay');
    const trackConfirmName    = document.getElementById('track-confirm-name');
    const trackConfirmCancel  = document.getElementById('track-confirm-cancel');
    const trackConfirmRemove  = document.getElementById('track-confirm-remove');

    // Track pending removal — set when confirm popup opens
    let _pendingRemoveNoteId = null;

    function showP5Error(msg) {
        if (!p5ErrorToast) return;
        p5ErrorToast.textContent = msg;
        p5ErrorToast.classList.add('visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => p5ErrorToast.classList.remove('visible'), 3000);
    }

    // Show / hide Manage Tracks button.
    // Rule: always visible for admin. Hidden only when Save Track is showing (setUploadLock handles that).
    // IMPORTANT: this function must NOT reference p5SaveBtn or any const declared later in this
    // DOMContentLoaded block, because applyRole() can call it before those consts are initialised.
    window.updateManageTracksBtn = function () {
        if (!p5ManageTracksBtn) return;
        try {
            const session = JSON.parse(localStorage.getItem('grace_session') || '{}');
            p5ManageTracksBtn.style.display = (session.role === 'admin') ? '' : 'none';
        } catch {
            p5ManageTracksBtn.style.display = 'none';
        }
    };
    // Alias so applyRole and legacy code still works
    window.updateRemoveTrackBtn = window.updateManageTracksBtn;


    // Render a cached note to the UI
    function displayTrackNote(index) {
        const note = trackNotes[index];
        if (note === undefined) {
            // Not cached yet — blank the fields and trigger a fetch
            if (p5TitleEl)   p5TitleEl.value   = '';
            if (p5DetailsEl) p5DetailsEl.value = '';
            p5Baseline = { heading: '', body: '' };
            fetchNoteForTrack(index);
            return;
        }
        if (p5TitleEl)   p5TitleEl.value   = note.heading || '';
        if (p5DetailsEl) p5DetailsEl.value = note.body    || '';
        p5Baseline = { heading: note.heading || '', body: note.body || '' };
    }

    // Lazy-fetch a track's note from its own Cloudinary file.
    // If no note is saved yet, shows empty placeholders (admin fills these in via the note area).
    async function fetchNoteForTrack(index) {
        const meta = trackMeta[index];
        if (!meta) return;
        try {
            const res  = await fetch(`/api/track-note/${encodeURIComponent(meta.noteId)}`);
            const note = await res.json();
            // Use saved note if it exists; otherwise show blank template
            trackNotes[index] = (note && (note.heading || note.body))
                ? note
                : { heading: '', body: '' };
        } catch {
            trackNotes[index] = { heading: '', body: '' };
        }
        if (index === currentTrackIndex) displayTrackNote(index);
    }


    // ── Disc reverse animation — uses the same shared lock as advanceDiscs ────
    window.reverseDiscs = function () {
        if (!p5Discs[0]) return;
        if (_discAnimLocked) { _discAnimPending = 'reverse'; return; }
        _runDiscAnim('reverse');
    };

    // ── Custom track list helpers ─────────────────────────────────────────────
    function saveTrackList() {
        // Persist ALL tracks (everything is a custom track now — no hardcoded defaults)
        return fetch('/api/track-list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tracks: trackMeta })
        }).catch(err => console.error('Could not save track list:', err));
    }


    function loadTrackList() {
        return fetch('/api/track-list')
            .then(res => res.json())
            .then(customTracks => {
                if (Array.isArray(customTracks) && customTracks.length > 0) {
                    customTracks.forEach(t => {
                        trackMeta.push(t);
                        tracks.push(t.url);
                    });
                }
            })
            .catch(() => {});
    }

    // Boot: load track list from Cloudinary, then set up audio + note if tracks exist
    loadTrackList().then(() => {
        if (tracks.length > 0) {
            if (audioElement) audioElement.src = tracks[currentTrackIndex];
            fetchNoteForTrack(currentTrackIndex);
        }
        // Show Manage Tracks button if admin (always — even with empty list)
        window.updateManageTracksBtn();
    });


    // ── Save Note button ──────────────────────────────────────────────────────
    if (p5NoteSaveBtn) {
        p5NoteSaveBtn.addEventListener('click', () => {
            const heading = (p5TitleEl   ? p5TitleEl.value.trim()   : '');
            const body    = (p5DetailsEl ? p5DetailsEl.value.trim() : '');

            if (heading === p5Baseline.heading.trim() && body === p5Baseline.body.trim()) {
                showP5Error('Please write something first!');
                return;
            }

            // Update cache
            trackNotes[currentTrackIndex] = { heading, body };
            p5Baseline = { heading, body };

            p5NoteSaveBtn.textContent = 'Saving...';
            p5NoteSaveBtn.disabled    = true;

            const noteId = trackMeta[currentTrackIndex].noteId;
            fetch(`/api/track-note/${encodeURIComponent(noteId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ heading, body })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    p5NoteSaveBtn.textContent = 'Saved!';
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

    // -- Track List popup logic
    function buildTrackListRows() {
        if (!trackListBody) return;
        trackListBody.innerHTML = '';

        const customTracks = trackMeta.slice(DEFAULT_TRACKS.length);
        if (customTracks.length === 0) {
            trackListBody.innerHTML = '<p class="track-list-empty">No custom tracks added yet.</p>';
            return;
        }

        customTracks.forEach((meta, relIdx) => {
            const absIdx = DEFAULT_TRACKS.length + relIdx;
            const row    = document.createElement('div');
            row.className = 'track-list-item';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'track-list-item-name';
            nameSpan.textContent = meta.name || meta.noteId;

            const removeIcon = document.createElement('img');
            removeIcon.src       = 'remove-ui-svgrepo-com.svg';
            removeIcon.alt       = 'Remove track';
            removeIcon.className = 'track-list-remove-icon';
            removeIcon.title     = `Remove "${meta.name || meta.noteId}"`;
            removeIcon.addEventListener('click', () => {
                openConfirmPopup(meta, absIdx);
            });

            row.appendChild(nameSpan);
            row.appendChild(removeIcon);
            trackListBody.appendChild(row);
        });
    }

    function openTrackListPopup() {
        buildTrackListRows();
        if (trackListOverlay) trackListOverlay.style.display = 'flex';
    }

    function closeTrackListPopup() {
        if (trackListOverlay) trackListOverlay.style.display = 'none';
    }

    // ── Confirmation popup logic ───────────────────────────────────────────
    function openConfirmPopup(meta) {
        _pendingRemoveNoteId = meta.noteId;
        if (trackConfirmName) trackConfirmName.textContent = meta.name || meta.noteId;
        // Reset remove button state
        if (trackConfirmRemove) {
            trackConfirmRemove.textContent = 'Remove';
            trackConfirmRemove.disabled    = false;
        }
        if (trackConfirmOverlay) trackConfirmOverlay.style.display = 'flex';
    }

    function closeConfirmPopup() {
        if (trackConfirmOverlay) trackConfirmOverlay.style.display = 'none';
        _pendingRemoveNoteId = null;
    }

    // Wire up static popup buttons
    if (trackListCloseBtn) {
        trackListCloseBtn.addEventListener('click', closeTrackListPopup);
    }

    if (trackConfirmCancel) {
        trackConfirmCancel.addEventListener('click', () => {
            closeConfirmPopup();
            openTrackListPopup(); // Go back to track list
        });
    }

    if (trackConfirmRemove) {
        trackConfirmRemove.addEventListener('click', () => {
            const noteId = _pendingRemoveNoteId;
            if (!noteId) return;

            trackConfirmRemove.textContent = 'Removing...';
            trackConfirmRemove.disabled    = true;

            fetch(`/api/track/${encodeURIComponent(noteId)}`, { method: 'DELETE' })
                .then(res => res.json())
                .then(data => {
                    if (!data.success) throw new Error(data.error || 'Remove failed');

                    // Remove from all in-memory arrays by noteId (safe regardless of index drift)
                    const idx = trackMeta.findIndex(t => t.noteId === noteId);
                    if (idx !== -1) {
                        trackMeta.splice(idx, 1);
                        tracks.splice(idx, 1);
                        trackNotes.splice(idx, 1);

                        // If the removed track was the active one, navigate to a safe index
                        if (currentTrackIndex >= idx) {
                            currentTrackIndex = Math.max(0, currentTrackIndex - 1);
                        }
                        if (audioElement) audioElement.src = tracks[currentTrackIndex] || '';
                        fetchNoteForTrack(currentTrackIndex);
                    }

                    trackConfirmRemove.textContent = 'Removed ✓';
                    setTimeout(() => {
                        closeConfirmPopup();
                        closeTrackListPopup();
                        window.updateManageTracksBtn();
                    }, 1200);
                })
                .catch(err => {
                    console.error('Remove track error:', err);
                    trackConfirmRemove.textContent = 'Error — try again';
                    setTimeout(() => {
                        trackConfirmRemove.textContent = 'Remove';
                        trackConfirmRemove.disabled    = false;
                    }, 2500);
                });
        });
    }

    // Open popup when Manage Tracks button clicked
    if (p5ManageTracksBtn) {
        p5ManageTracksBtn.addEventListener('click', openTrackListPopup);
    }

    // ── Upload lock: hide Manage Tracks during upload, restore correctly after ──
    function setUploadLock(locked) {
        isUploading = locked;
        [p5NextBtn, p5PrevBtn, nextTrackBtn, playPauseBtn, p5AddBtn].forEach(btn => {
            if (btn) btn.disabled = locked;
        });
        if (locked) {
            // Hide Manage Tracks while upload in progress
            if (p5ManageTracksBtn) p5ManageTracksBtn.style.display = 'none';
        } else {
            // Restore correctly (respects admin check, not just blind show)
            window.updateManageTracksBtn();
        }

    }

    // ── Add Track + Save Track ───────────────────────────────────────────────
    const p5AddBtn    = document.getElementById('p5-add-btn');
    const p5FileInput = document.getElementById('p5-file-input');
    const p5SaveBtn   = document.getElementById('p5-save-btn');

    if (p5AddBtn && p5FileInput) {
        p5AddBtn.addEventListener('click', () => p5FileInput.click());

        p5FileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                p5SaveBtn.style.display = '';
                // Hide Manage Tracks while Save Track takes its place
                if (p5ManageTracksBtn) p5ManageTracksBtn.style.display = 'none';
            }
        });

        if (p5SaveBtn) {
            p5SaveBtn.addEventListener('click', () => {
                const file = p5FileInput.files[0];
                if (!file) return;

                p5SaveBtn.textContent = 'Saving...';
                p5SaveBtn.disabled    = true;
                setUploadLock(true);

                const formData = new FormData();
                formData.append('file', file);

                fetch('/api/add-track', { method: 'POST', body: formData })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            const newMeta = { url: data.url, name: data.originalName.replace(/\.[^/.]+$/, ''), noteId: data.noteId };
                            trackMeta.push(newMeta);
                            tracks.push(data.url);
                            saveTrackList();

                            p5SaveBtn.textContent = 'Saved!';
                            setTimeout(() => {
                                p5SaveBtn.style.display = 'none';
                                p5SaveBtn.textContent   = 'Save Track';
                                p5SaveBtn.disabled      = false;
                                p5FileInput.value       = '';
                                setUploadLock(false);

                                // Manage Tracks reappears after Save Track hides
                                window.updateManageTracksBtn();

                                // Auto-navigate to the newly added track
                                currentTrackIndex = tracks.length - 1;
                                if (audioElement) audioElement.src = tracks[currentTrackIndex];
                                fetchNoteForTrack(currentTrackIndex);
                                if (window.advanceDiscs) window.advanceDiscs();
                            }, 2000);
                        } else {
                            throw new Error(data.error || 'Upload failed');
                        }
                    })
                    .catch(err => {
                        console.error('Add track error:', err);
                        p5SaveBtn.textContent = 'Error';
                        p5SaveBtn.disabled    = false;
                        setUploadLock(false);
                        window.updateManageTracksBtn(); // restore button on error too
                        setTimeout(() => { p5SaveBtn.textContent = 'Save Track'; }, 4000);
                    });
            });
        }
    }

    // ── Audio player ──────────────────────────────────────────────────────────
    if (audioElement) {
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
            displayTrackNote(currentTrackIndex);
            window.updateRemoveTrackBtn();
            if (window.advanceDiscs) window.advanceDiscs();
        };

        window.playPrevTrack = function () {
            currentTrackIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
            audioElement.src  = tracks[currentTrackIndex];
            audioElement.play();
            if (playIcon)  playIcon.style.display  = 'none';
            if (pauseIcon) pauseIcon.style.display = 'block';
            displayTrackNote(currentTrackIndex);
            window.updateRemoveTrackBtn();
            if (window.reverseDiscs) window.reverseDiscs();
        };

        if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlay);
        if (nextTrackBtn) nextTrackBtn.addEventListener('click', window.playNextTrack);

        if (p5NextBtn) {
            p5NextBtn.addEventListener('click', function () {
                if (this.disabled || isUploading) return;
                this.disabled = true;
                window.playNextTrack();
                setTimeout(() => { this.disabled = false; }, 2000);
            });
        }

        if (p5PrevBtn) {
            p5PrevBtn.addEventListener('click', function () {
                if (this.disabled || isUploading) return;
                this.disabled = true;
                window.playPrevTrack();
                setTimeout(() => { this.disabled = false; }, 2000);
            });
        }

        if (audioSlider) {
            audioSlider.addEventListener('input', (e) => {
                audioElement.volume    = e.target.value / 100;
                sliderFill.style.width = `${e.target.value}%`;
            });
        }

        audioElement.addEventListener('ended', window.playNextTrack);
    }
});


