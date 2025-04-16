const express = require('express');
const fs = require('fs');
const path = require('path');
const verifyToken = require('../middlewares/auth');

const router = express.Router();
const uploadsPath = path.join(__dirname, '..', 'uploads');

// 🔓 GET /media : Liste simple des fichiers (racine uniquement)
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

// 🔓 GET /media/random-image : une image aléatoire (dans tous les sous-dossiers)
router.get('/random-image', (req, res) => {
    const images = [];

    const walk = (dir) => {
        fs.readdirSync(dir).forEach(file => {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                walk(fullPath); // sous-dossiers
            } else if (/\.(jpe?g|png|webp|gif|JPG)$/i.test(file)) {
                const relativePath = fullPath.replace(uploadsPath, '').replace(/\\/g, '/');
                images.push(`/uploads${relativePath}`);
            }
        });
    };

    walk(uploadsPath);

    if (images.length === 0) {
        return res.status(404).json({ error: 'Aucune image trouvée' });
    }

    const randomImage = images[Math.floor(Math.random() * images.length)];
    res.json({ url: randomImage });
});

// 🔐 DELETE /media : supprimer un fichier (protégé)
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
