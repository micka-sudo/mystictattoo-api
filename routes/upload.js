const express = require('express');
const router = express.Router();

// Middleware image : upload + conversion HEIC → JPG
const { imageUpload, convertHeicToJpeg } = require('../middlewares/imageUpload');

// Middleware vidéo : upload + conversion MOV → MP4
const { videoUpload, convertMovToMp4 } = require('../middlewares/videoUpload');

/**
 * @route   POST /api/upload/image
 * @desc    Upload d'image (JPG, PNG, HEIC) avec conversion HEIC → JPG
 */
router.post('/image', imageUpload, convertHeicToJpeg, (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucune image reçue' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    res.status(200).json({ url: imageUrl });
});

/**
 * @route   POST /api/upload/video
 * @desc    Upload de vidéo (.mov) avec conversion automatique MOV → MP4
 */
router.post('/video', videoUpload, convertMovToMp4, (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucune vidéo reçue' });
    }

    const videoUrl = `/uploads/${req.file.filename}`;
    res.status(200).json({ url: videoUrl });
});

module.exports = router;
