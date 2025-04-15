const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const heicConvert = require('heic-convert');

const router = express.Router();

// Stockage temporaire en RAM
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/', upload.single('file'), async (req, res) => {
    try {
        const { category, tags } = req.body;
        const file = req.file;

        if (!file || !category) {
            return res.status(400).json({ error: 'Fichier et catégorie requis.' });
        }

        const ext = path.extname(file.originalname).toLowerCase();
        const fileNameBase = path.basename(file.originalname, ext).replace(/\s+/g, '-');
        const categoryDir = path.join(__dirname, '..', 'uploads', category);

        // Crée le dossier si besoin
        if (!fs.existsSync(categoryDir)) {
            fs.mkdirSync(categoryDir, { recursive: true });
        }

        let finalFileName = '';
        let finalPath = '';

        if (ext === '.heic') {
            // Convert HEIC to JPEG
            const jpegPath = path.join(categoryDir, `${fileNameBase}.jpg`);
            const outputBuffer = await heicConvert({
                buffer: file.buffer,
                format: 'JPEG',
                quality: 1,
            });
            fs.writeFileSync(jpegPath, outputBuffer);
            finalFileName = `${fileNameBase}.jpg`;
            finalPath = jpegPath;
        } else {
            // Sauvegarde directe
            const targetExt = ext.match(/\.jpe?g|\.png|\.webp|\.mp4|\.webm/) ? ext : '.jpg';
            const safeName = `${fileNameBase}${targetExt}`;
            const filePath = path.join(categoryDir, safeName);
            fs.writeFileSync(filePath, file.buffer);
            finalFileName = safeName;
            finalPath = filePath;
        }

        console.log(`✅ Fichier enregistré : ${finalPath}`);
        res.status(200).json({ message: 'Fichier enregistré', filename: finalFileName });
    } catch (error) {
        console.error('❌ Erreur upload :', error.message);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;
