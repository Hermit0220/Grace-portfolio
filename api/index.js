const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');
const path = require('path');
const https = require('https');

dotenv.config();

// Configure Cloudinary - supports both CLOUDINARY_URL and individual vars
if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary.config({ 
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
      api_key: process.env.CLOUDINARY_API_KEY, 
      api_secret: process.env.CLOUDINARY_API_SECRET 
    });
}
// If CLOUDINARY_URL is set, the cloudinary SDK picks it up automatically

const app = express();
app.use(cors());
app.use(express.json());

// Set up Multer with Memory Storage (perfect for serverless Vercel!)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Serve static files from public directory (useful for local dev)
app.use(express.static(path.join(__dirname, '../public')));

// Helper: extract Cloudinary public_id from a secure_url
function getPublicId(imageUrl) {
    if (!imageUrl) return null;
    // Matches /upload/v12345/folder/filename.ext and extracts 'folder/filename'
    const match = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
    return match ? match[1] : null;
}

// Helper: fetch URL content as text (node built-in https)
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => resolve(data));
            res.on('error', reject);
        }).on('error', reject);
    });
}

// Helper: move an image to User_Removed folder in Cloudinary
async function moveImageToRemoved(imageUrl) {
    if (!imageUrl) return;
    try {
        const oldPublicId = getPublicId(imageUrl);
        if (oldPublicId) {
            const filename = oldPublicId.split('/').pop();
            const newPublicId = `User_Removed/${filename}`;
            await cloudinary.uploader.rename(oldPublicId, newPublicId);
            console.log(`Moved ${oldPublicId} -> ${newPublicId}`);
        }
    } catch (err) {
        // Non-fatal — log but don't crash
        console.error('Failed to move image to User_Removed:', err.message);
    }
}

// Helper: fetch or initialize photo list
async function getPhotoList() {
    try {
        const result = await cloudinary.api.resource('User/notes/photo-list', { resource_type: 'raw' });
        const text = await fetchUrl(result.secure_url + `?_cb=${Date.now()}`);
        return JSON.parse(text);
    } catch (e) {
        // Fallback: build list from existing files if JSON doesn't exist yet
        const result = await cloudinary.api.resources({ type: 'upload', prefix: 'User/', max_results: 100 });
        return result.resources
            .filter(r => r.public_id.match(/photo-\d+/))
            .map(r => ({
                slotId: r.public_id.replace('User/', ''),
                imageData: r.secure_url
            }));
    }
}

// Helper: save photo list to Cloudinary
async function savePhotoList(photos) {
    const json = JSON.stringify(photos);
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'User/notes', public_id: 'photo-list', overwrite: true, resource_type: 'raw' },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        const rs = new Readable();
        rs.push(Buffer.from(json, 'utf-8'));
        rs.push(null);
        rs.pipe(uploadStream);
    });
}

// GET /api/photos
app.get('/api/photos', async (req, res) => {
    try {
        const photos = await getPhotoList();
        res.json(photos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/upload
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        const { slotId } = req.body;
        if (!slotId || !req.file) return res.status(400).json({ error: 'Missing slotId or file' });

        // Upload new image buffer to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder: 'User', public_id: slotId, overwrite: true, resource_type: 'auto' },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            const rs = new Readable();
            rs.push(req.file.buffer);
            rs.push(null);
            rs.pipe(uploadStream);
        });

        // Update photo list
        let photos = await getPhotoList();
        photos = photos.filter(p => p.slotId !== slotId); // remove old entry if exists
        photos.push({ slotId, imageData: uploadResult.secure_url });
        await savePhotoList(photos);

        res.json({ slotId, imageData: uploadResult.secure_url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/photos/:slotId
// Removes the image from the website's JSON list, without deleting the file from Cloudinary database
app.delete('/api/photos/:slotId', async (req, res) => {
    try {
        const { slotId } = req.params;
        let photos = await getPhotoList();
        
        // Remove from the website's display list
        photos = photos.filter(p => p.slotId !== slotId);
        await savePhotoList(photos);

        res.json({ message: 'Removed from website successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/note
// Returns the Cloudinary URL for the raw text note (if it exists)
app.get('/api/note', async (req, res) => {
    try {
        const result = await cloudinary.api.resource('User/p4-note.txt', { resource_type: 'raw' });
        res.json({ url: result.secure_url });
    } catch (err) {
        // If it doesn't exist, just return null URL
        res.json({ url: null });
    }
});

// POST /api/note
// Uploads a raw text buffer to Cloudinary as User/p4-note.txt
app.post('/api/note', async (req, res) => {
    try {
        const { text } = req.body;
        
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { 
                    folder: 'User',
                    public_id: 'p4-note.txt',
                    overwrite: true,
                    resource_type: 'raw'
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );

            const readableStream = new Readable();
            readableStream.push(Buffer.from(text || '', 'utf-8'));
            readableStream.push(null);
            readableStream.pipe(uploadStream);
        });

        res.json({ success: true, url: uploadResult.secure_url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helper: upload a raw JSON string to User/notes/{publicId} in Cloudinary
async function uploadNoteFile(publicId, jsonString) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'User/notes', public_id: publicId, overwrite: true, resource_type: 'raw' },
            (error, result) => { if (error) reject(error); else resolve(result); }
        );
        const rs = new Readable();
        rs.push(Buffer.from(jsonString, 'utf-8'));
        rs.push(null);
        rs.pipe(uploadStream);
    });
}

// GET /api/track-note/:noteId
// Returns the individual note JSON for a given track. Returns null if not saved yet.
app.get('/api/track-note/:noteId', async (req, res) => {
    const { noteId } = req.params;
    try {
        const result = await cloudinary.api.resource(`User/notes/note-${noteId}`, { resource_type: 'raw' });
        const text = await fetchUrl(result.secure_url + `?_cb=${Date.now()}`);
        res.json(JSON.parse(text));
    } catch (err) {
        res.json(null); // No note saved yet — frontend will use defaults
    }
});

// POST /api/track-note/:noteId
// Saves the individual note { heading, body } for a given track to its own file.
app.post('/api/track-note/:noteId', async (req, res) => {
    const { noteId } = req.params;
    const { heading, body } = req.body;
    try {
        await uploadNoteFile(`note-${noteId}`, JSON.stringify({ heading, body }));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/track/:noteId
// Removes the track from the custom track list AND deletes its individual note file.
app.delete('/api/track/:noteId', async (req, res) => {
    const { noteId } = req.params;
    try {
        // Load current track list
        let trackList = [];
        try {
            const result = await cloudinary.api.resource('User/notes/track-list', { resource_type: 'raw' });
            const text = await fetchUrl(result.secure_url + `?_cb=${Date.now()}`);
            trackList = JSON.parse(text);
        } catch (e) { /* list may not exist yet */ }

        // Remove this track from the list and re-save
        trackList = trackList.filter(t => t.noteId !== noteId);
        await uploadNoteFile('track-list', JSON.stringify(trackList));

        // Delete the track's individual note file (non-fatal if it doesn't exist)
        try {
            await cloudinary.uploader.destroy(`User/notes/note-${noteId}`, { resource_type: 'raw' });
        } catch (e) { /* note may not exist */ }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/add-track
// Uploads an audio file to Cloudinary (resource_type: video) and returns its URL.
app.post('/api/add-track', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        const originalName = req.file.originalname.replace(/\.[^/.]+$/, '');
        const safeId = originalName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 60);

        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'User/audio',
                    public_id: safeId,
                    overwrite: false,
                    resource_type: 'video'  // Cloudinary treats audio as video
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            const rs = new Readable();
            rs.push(req.file.buffer);
            rs.push(null);
            rs.pipe(uploadStream);
        });

        res.json({ success: true, url: uploadResult.secure_url, originalName: req.file.originalname, noteId: safeId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/track-list
// Returns saved custom tracks. Returns [] if not found OR if data is old format (missing noteId).
app.get('/api/track-list', async (req, res) => {
    try {
        const result = await cloudinary.api.resource('User/notes/track-list', { resource_type: 'raw' });
        const text = await fetchUrl(result.secure_url + `?_cb=${Date.now()}`);
        const parsed = JSON.parse(text);
        // Validate new format: every entry must have noteId.
        // Old format (url + name only) is treated as empty — auto-clears old custom tracks.
        if (!Array.isArray(parsed) || parsed.some(t => !t.noteId)) {
            return res.json([]);
        }
        res.json(parsed);
    } catch (err) {
        res.json([]);
    }
});

// POST /api/track-list
// Saves the full custom track list (url + name + noteId) to Cloudinary.
app.post('/api/track-list', async (req, res) => {
    try {
        const { tracks } = req.body;
        await uploadNoteFile('track-list', JSON.stringify(tracks));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
