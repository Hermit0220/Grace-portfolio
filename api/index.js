const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');
const path = require('path');

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

// GET /api/photos
// Lists all images from the User/ folder in Cloudinary
app.get('/api/photos', async (req, res) => {
    try {
        const result = await cloudinary.api.resources({
            type: 'upload',
            prefix: 'User/',
            max_results: 100
        });

        // Return in same shape the frontend expects: [{ slotId, imageData }]
        // slotId is encoded as the filename (e.g. "User/photo-2" -> slotId "photo-2")
        const photos = result.resources.map(r => ({
            slotId: r.public_id.replace('User/', ''),
            imageData: r.secure_url
        }));

        res.json(photos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/upload
// Uploads an image to Cloudinary under the User/ folder
// Body: FormData with 'slotId' (string) and 'file' (image file)
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        const { slotId } = req.body;

        if (!slotId || !req.file) {
            return res.status(400).json({ error: 'Missing slotId or file' });
        }

        // Check if an existing image for this slotId exists in Cloudinary
        try {
            const existing = await cloudinary.api.resource(`User/${slotId}`);
            if (existing) {
                // Move old image to User_Removed before uploading new one
                await moveImageToRemoved(existing.secure_url);
            }
        } catch (e) {
            // Resource doesn't exist yet — that's fine, just proceed
        }

        // Upload new image buffer to Cloudinary
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { 
                    folder: 'User',
                    public_id: slotId,   // Use slotId as filename for easy lookup
                    overwrite: true,
                    resource_type: 'auto'
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );

            const readableStream = new Readable();
            readableStream.push(req.file.buffer);
            readableStream.push(null);
            readableStream.pipe(uploadStream);
        });

        res.json({ slotId, imageData: uploadResult.secure_url });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/photos/:slotId
// Moves the image from User/ to User_Removed/ in Cloudinary
app.delete('/api/photos/:slotId', async (req, res) => {
    try {
        const { slotId } = req.params;

        // Get the resource first so we have its URL
        const existing = await cloudinary.api.resource(`User/${slotId}`);
        await moveImageToRemoved(existing.secure_url);

        res.json({ message: 'Moved to User_Removed successfully' });
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

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
