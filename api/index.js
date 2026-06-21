const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');
const path = require('path');

dotenv.config();

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME) {
    cloudinary.config({ 
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
      api_key: process.env.CLOUDINARY_API_KEY, 
      api_secret: process.env.CLOUDINARY_API_SECRET 
    });
}

const app = express();
app.use(cors());
app.use(express.json());

// Set up Multer with Memory Storage (perfect for serverless Vercel!)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Serve static files from public directory (useful for local dev)
app.use(express.static(path.join(__dirname, '../public')));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Schema
const photoSchema = new mongoose.Schema({
    slotId: { type: String, required: true, unique: true },
    imageData: { type: String, required: true } // Now stores Cloudinary secure_url
});
const Photo = mongoose.model('Photo', photoSchema);

// Helper function to move images to User_Removed folder
async function moveImageToRemoved(imageUrl) {
    if (!imageUrl) return;
    try {
        const match = imageUrl.match(/\/v\d+\/(.+)\.\w+$/);
        if (match && match[1]) {
            const oldPublicId = match[1];
            const filename = oldPublicId.split('/').pop();
            const newPublicId = `User_Removed/${filename}`;
            await cloudinary.uploader.rename(oldPublicId, newPublicId);
            console.log(`Moved ${oldPublicId} to ${newPublicId}`);
        }
    } catch (err) {
        console.error("Failed to move image to User_Removed:", err);
    }
}

// API Routes
app.get('/api/photos', async (req, res) => {
    try {
        const photos = await Photo.find();
        res.json(photos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Upload Endpoint: Expects FormData with 'slotId' and 'file'
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        const { slotId } = req.body;
        
        if (!slotId || !req.file) {
            return res.status(400).json({ error: 'Missing slotId or file' });
        }

        // If a photo already exists in this slot, move the old one to User_Removed
        const existingPhoto = await Photo.findOne({ slotId });
        if (existingPhoto) {
            await moveImageToRemoved(existingPhoto.imageData);
        }

        // Upload Buffer to Cloudinary via stream
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: "User", resource_type: "auto" }, // resource_type 'auto' supports audio/video later
            async (error, result) => {
                if (error) return res.status(500).json({ error: error.message });

                // Save Cloudinary URL to MongoDB
                const secure_url = result.secure_url;
                
                const photo = await Photo.findOneAndUpdate(
                    { slotId },
                    { imageData: secure_url },
                    { new: true, upsert: true }
                );
                
                res.json(photo);
            }
        );

        // Pipe the buffer to Cloudinary
        const readableStream = new Readable();
        readableStream.push(req.file.buffer);
        readableStream.push(null);
        readableStream.pipe(uploadStream);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Endpoint
app.delete('/api/photos/:slotId', async (req, res) => {
    try {
        const { slotId } = req.params;
        const photo = await Photo.findOneAndDelete({ slotId });
        if (!photo) {
            return res.status(404).json({ error: 'Photo not found' });
        }

        // Move the removed image to the User_Removed folder in Cloudinary
        await moveImageToRemoved(photo.imageData);

        res.json({ message: 'Deleted successfully' });
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
