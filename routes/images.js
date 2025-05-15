import express from 'express';
import { imageUpload, convertHeicToJpeg } from '../middleware/imageUpload';

const router = express.Router();

router.post('/upload', imageUpload, convertHeicToJpeg, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Aucune image reçue' });

    const imageUrl = `/uploads/${req.file.filename}`; // à adapter selon ta logique
    res.status(200).json({ url: imageUrl });
});

export default router;
