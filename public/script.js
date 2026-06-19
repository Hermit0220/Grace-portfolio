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
                    const container = document.querySelector(`.${photo.slotId}`);
                    if (container) {
                        const uploadContent = container.querySelector('.upload-content');
                        const uploadedImg = container.querySelector('.uploaded-img');
                        const removeBtn = container.querySelector('.remove-btn');
                        uploadContent.style.display = 'none';
                        uploadedImg.src = photo.imageData;
                        uploadedImg.style.display = 'block';
                        if (removeBtn) removeBtn.style.display = 'block';
                    }
                });
            }
        })
        .catch(err => console.error('Error fetching photos:', err));

    // Photo upload logic
    const uploadContainers = document.querySelectorAll('.photo-upload-container');

    uploadContainers.forEach(container => {
        const fileInput = container.querySelector('.file-input');
        const uploadContent = container.querySelector('.upload-content');
        const uploadedImg = container.querySelector('.uploaded-img');
        const removeBtn = container.querySelector('.remove-btn');

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
                    removeBtn.style.display = 'none';
                    uploadContent.style.display = 'flex';
                    fileInput.value = ''; // reset

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
                const reader = new FileReader();
                reader.onload = (e) => {
                    const base64String = e.target.result;

                    // Hide the add icon/text and show the image locally first for snappy UI
                    uploadContent.style.display = 'none';
                    uploadedImg.src = base64String;
                    uploadedImg.style.display = 'block';
                    if (removeBtn) removeBtn.style.display = 'block';

                    // Extract the slot class (e.g., "photo-1")
                    const slotClass = Array.from(container.classList).find(c => c.startsWith('photo-'));

                    if (slotClass) {
                        const formData = new FormData();
                        formData.append('slotId', slotClass);
                        formData.append('file', file);

                        fetch('/api/upload', {
                            method: 'POST',
                            body: formData // Send the raw file to the Express server!
                        }).catch(err => console.error('Error uploading photo to DB:', err));
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    });

    // --- Music Player Logic ---
    const audioElement = document.getElementById('audio-element');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const audioSlider = document.getElementById('audio-slider');
    const sliderFill = document.getElementById('slider-fill');
    const nextTrackBtn = document.getElementById('next-track-btn');

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
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
            } else {
                audioElement.pause();
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
            }
        }

        function playNextTrack() {
            currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
            audioElement.src = tracks[currentTrackIndex];
            audioElement.play();
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        }

        if (playPauseBtn) playPauseBtn.addEventListener('click', togglePlay);
        if (nextTrackBtn) nextTrackBtn.addEventListener('click', playNextTrack);

        // Adjust volume when user drags slider
        if (audioSlider) {
            audioSlider.addEventListener('input', (e) => {
                const volume = e.target.value / 100;
                audioElement.volume = volume;
                sliderFill.style.width = `${e.target.value}%`;
            });
        }

        // Auto-play next track when current ends
        audioElement.addEventListener('ended', playNextTrack);
    }
});
