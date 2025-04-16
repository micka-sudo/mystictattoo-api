const express = require('express');
const fs = require('fs');
const path = require('path');
const verifyToken = require('../middlewares/auth');

const router = express.Router();
const uploadsPath = path.join(__dirname, '..', 'uploads');

// 🔓 GET /media : liste les fichiers dans /uploads ou /uploads/{style}
router.get('/', (req, res) => {
    const style = req.query.style;
    const targetPath = style
        ? path.join(uploadsPath, style)
        : uploadsPath;

    if (!fs.existsSync(targetPath)) {
        return res.status(404).json({ error: 'Dossier introuvable' });
    }

    const walk = (dir) => {
        const files = [];

        fs.readdirSync(dir).forEach((file) => {
            const fullPath = path.join(dir, file);
            const relativePath = fullPath.replace(uploadsPath, '').replace(/\\/g, '/');

            if (fs.statSync(fullPath).isFile()) {
                files.push({
                    file,
                    url: '/uploads' + relativePath,
                    type: /\.(mp4|mov|avi)$/i.test(file) ? 'video' : 'image',
                    category: style || 'all',
                    tags: []
                });
            }
        });

        return files;
    };

    try {
        const media = walk(targetPath);
        res.json(media);
    } catch (err) {
        console.error('Erreur lecture médias', err);
        res.status(500).json({ error: 'Erreur lecture médias' });
    }
});

// 🔓 GET /media/categories : retourne les sous-dossiers (styles)
router.get('/categories', (req, res) => {
    try {
        const categories = fs.readdirSync(uploadsPath)
            .filter(name => {
                const fullPath = path.join(uploadsPath, name);
                return fs.statSync(fullPath).isDirectory();
            });
        res.json(categories);
    } catch (err) {
        console.error('Erreur lecture catégories', err);
        res.status(500).json({ error: 'Impossible de lire les catégories' });
    }
});

// 🔓 GET /media/random-image : image aléatoire (globale ou d’un style)
router.get('/random-image', (req, res) => {
    const style = req.query.style;
    const targetPath = style
        ? path.join(uploadsPath, style)
        : uploadsPath;

    const images = [];

    const walk = (dir) => {
        fs.readdirSync(dir).forEach(file => {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                walk(fullPath); // récursif
            } else if (/\.(jpe?g|png|webp|gif|JPG)$/i.test(file)) {
                const relativePath = fullPath.replace(uploadsPath, '').replace(/\\/g, '/');
                images.push(`/uploads${relativePath}`);
            }
        });
    };

    try {
        walk(targetPath);

        if (images.length === 0) {
            return res.status(404).json({ error: 'Aucune image trouvée' });
        }

        const randomImage = images[Math.floor(Math.random() * images.length)];
        res.json({ url: randomImage });
    } catch (err) {
        console.error('Erreur image aléatoire', err);
        res.status(500).json({ error: 'Erreur lecture aléatoire' });
    }
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
