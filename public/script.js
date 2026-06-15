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
            if(Array.isArray(photos)) {
                photos.forEach(photo => {
                    const container = document.querySelector(`.${photo.slotId}`);
                    if (container) {
                        const uploadContent = container.querySelector('.upload-content');
                        const uploadedImg = container.querySelector('.uploaded-img');
                        uploadContent.style.display = 'none';
                        uploadedImg.src = photo.imageData;
                        uploadedImg.style.display = 'block';
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

        // Clicking the container triggers the hidden file input
        container.addEventListener('click', () => {
            fileInput.click();
        });

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
});
