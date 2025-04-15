const express = require('express');
const fs = require('fs');
const path = require('path');
const verifyToken = require('../middlewares/auth');

const router = express.Router();
const uploadsPath = path.join(__dirname, '..', 'uploads');

// 🔓 GET = public
router.get('/', (req, res) => {
    fs.readdir(uploadsPath, (err, files) => {
        if (err) return res.status(500).json({ error: 'Erreur lecture fichiers' });

        const media = files.map((file) => ({
            file,
            url: '/uploads/' + file,
            type: /\.(mp4|mov|avi)$/i.test(file) ? 'video' : 'image',
            category: 'unknown',
            tags: [],
        }));

        res.json(media);
    });
});

// 🔐 DELETE = protégé
router.delete('/', verifyToken, (req, res) => {
    const { file } = req.body;

    const fullPath = path.join(uploadsPath, file);
    if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'Fichier introuvable' });
    }

    fs.unlink(fullPath, (err) => {
        if (err) return res.status(500).json({ error: 'Erreur suppression' });
        res.json({ message: 'Fichier supprimé avec succès' });
    });
});

module.exports = router;
