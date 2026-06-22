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
    // Fetch existing photos on load
    fetch('/api/photos')
        .then(res => res.json())
        .then(photos => {
            if (Array.isArray(photos)) {
                photos.forEach(photo => {
                    // slotId maps to a CSS class on the container (e.g. "photo-1")
                    const container = document.querySelector(`.upload-container.${photo.slotId}`) 
                                   || document.querySelector(`.${photo.slotId}`);
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
                        if (saveBtn) saveBtn.style.display = 'none'; // already saved, hide save btn
                    }
                });
            }
        })
        .catch(err => console.error('Error fetching photos:', err));

    // Photo upload logic
    const uploadContainers = document.querySelectorAll('.photo-upload-container');

    uploadContainers.forEach(container => {
        let currentSelectedFile = null;
        const fileInput = container.querySelector('.file-input');
        const uploadContent = container.querySelector('.upload-content');
        const uploadedImg = container.querySelector('.uploaded-img');
        const removeBtn = container.querySelector('.remove-btn');
        const saveBtn = container.querySelector('.polaroid-save-btn');

        // Clicking the container triggers the hidden file input
        container.addEventListener('click', () => {
            fileInput.click();
        });

        // Handle remove button click
        if (removeBtn) {
            removeBtn.addEventListener('click', (event) => {
                event.stopPropagation(); // Stop click from bubbling up to the container

                const slotClass = Array.from(container.classList).find(c => c.startsWith('photo-'));
                if (slotClass) {
                    // Update UI instantly
                    uploadedImg.style.display = 'none';
                    uploadedImg.src = '';
                    if (removeBtn) removeBtn.style.display = 'none';
                    if (saveBtn) saveBtn.style.display = 'none';
                    uploadContent.style.display = 'flex';
                    fileInput.value = ''; // reset
                    currentSelectedFile = null;

                    fetch(`/api/photos/${slotClass}`, {
                        method: 'DELETE'
                    }).catch(err => console.error('Error deleting photo:', err));
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
                event.stopPropagation(); // Stop click from bubbling up to the container
                if (!currentSelectedFile) return;

                const slotClass = Array.from(container.classList).find(c => c.startsWith('photo-'));
                if (slotClass) {
                    saveBtn.textContent = 'Saving...';
                    saveBtn.disabled = true;

                    const formData = new FormData();
                    formData.append('slotId', slotClass);
                    formData.append('file', currentSelectedFile);

                    fetch('/api/upload', {
                        method: 'POST',
                        body: formData // Send the raw file to the Express server!
                    })
                        .then(res => res.json())
                        .then(data => {
                            saveBtn.textContent = 'Saved!';
                            setTimeout(() => {
                                saveBtn.style.display = 'none';
                            }, 2000);
                            currentSelectedFile = null;
                        })
                        .catch(err => {
                            console.error('Error uploading photo to DB:', err);
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

        // Add Track & Save Track functionality (Dysfunctional DB for now)
        const p5AddBtn = document.getElementById('p5-add-btn');
        const p5FileInput = document.getElementById('p5-file-input');
        const p5SaveBtn = document.getElementById('p5-save-btn');

        if (p5AddBtn && p5FileInput) {
            p5AddBtn.addEventListener('click', () => {
                p5FileInput.click();
            });

            p5FileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    p5SaveBtn.style.display = 'block'; // Show Save button
                }
            });

            p5SaveBtn.addEventListener('click', () => {
                // Keep dysfunctional for now as per user request
                alert("File selected. Saving to database is not yet implemented.");
                p5SaveBtn.style.display = 'none';
                p5FileInput.value = '';
            });
        }
    }

    // --- Music Player Logic ---
    const audioElement = document.getElementById('audio-element');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const audioSlider = document.getElementById('audio-slider');
    const sliderFill = document.getElementById('slider-fill');
    const nextTrackBtn = document.getElementById('next-track-btn');
    const p5NextBtn = document.getElementById('p5-next-btn');

    const tracks = [
        "audio/Sade - Smooth Operator (Lyrics).mp3",
        "audio/The Neighbourhood - Reflections (Official Audio).mp3",
        "audio/Michael Jackson - Human Nature (Audio).mp3",
        "audio/Sade - Like a Tattoo (Audio).mp3",
        "audio/BTS - Let Me Know (방탄소년단 - Let Me Know) [Color Coded LyricsHanRomEng가사].mp4",
        "audio/Flatline.mp3",
        "audio/Excitement.mp3",
        "audio/Guns N' Roses - November Rain (Lyrics).mp3",
        "audio/Jhené Aiko - stranger (Audio).mp3",
        "audio/Salvatore.mp3"
    ];
    let currentTrackIndex = 0;

    if (audioElement) {
        audioElement.src = tracks[currentTrackIndex];

        // Initialize Volume
        audioElement.volume = 1.0;
        if (audioSlider) audioSlider.value = 100;
        if (sliderFill) sliderFill.style.width = '100%';

        function togglePlay() {
            if (audioElement.paused) {
                audioElement.play();
                if (playIcon) playIcon.style.display = 'none';
                if (pauseIcon) pauseIcon.style.display = 'block';
            } else {
                audioElement.pause();
                if (playIcon) playIcon.style.display = 'block';
                if (pauseIcon) pauseIcon.style.display = 'none';
            }
        }

        window.playNextTrack = function () {
            currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
            audioElement.src = tracks[currentTrackIndex];
            audioElement.play();
            if (playIcon) playIcon.style.display = 'none';
            if (pauseIcon) pauseIcon.style.display = 'block';

            // Advance discs on next track
            if (window.advanceDiscs) window.advanceDiscs();
        }

        if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlay);
        if (nextTrackBtn) nextTrackBtn.addEventListener('click', window.playNextTrack);
        if (p5NextBtn) p5NextBtn.addEventListener('click', window.playNextTrack);

        // Adjust volume when user drags slider
        if (audioSlider) {
            audioSlider.addEventListener('input', (e) => {
                const volume = e.target.value / 100;
                audioElement.volume = volume;
                sliderFill.style.width = `${e.target.value}%`;
            });
        }

        // Auto-play next track when current ends
        audioElement.addEventListener('ended', window.playNextTrack);
    }
});
