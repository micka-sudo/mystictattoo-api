const express = require('express');
const fs = require('fs');
const path = require('path');
const verifyToken = require('../middlewares/auth');

const router = express.Router();
const uploadsPath = path.join(__dirname, '..', 'uploads');

// ✅ Fonction utilitaire : lecture des fichiers média dans un dossier
const walkDir = (dir, baseCategory = '') => {
    const media = [];

    try {
        if (!fs.existsSync(dir)) return [];

        fs.readdirSync(dir).forEach((file) => {
            const fullPath = path.join(dir, file);
            const relativePath = fullPath.replace(uploadsPath, '').replace(/\\/g, '/');

            if (fs.statSync(fullPath).isDirectory()) {
                media.push(...walkDir(fullPath, path.basename(fullPath)));
            } else {
                media.push({
                    file,
                    url: '/uploads' + relativePath,
                    type: /\.(mp4|mov|avi)$/i.test(file) ? 'video' : 'image',
                    category: baseCategory || 'all',
                    tags: []
                });
            }
        });

        return media;
    } catch (err) {
        console.error(`Erreur lecture dossier ${dir}`, err);
        return [];
    }
};

// 🔓 GET /media : retourne les médias (optionnellement filtré par style)
router.get('/', (req, res) => {
    const style = req.query.style;
    const targetPath = style
        ? path.join(uploadsPath, style)
        : uploadsPath;

    try {
        const media = walkDir(targetPath, style);
        res.json(media);
    } catch (err) {
        console.error('Erreur lecture médias', err);
        res.status(500).json({ error: 'Erreur lecture médias' });
    }
});

// 🔓 GET /media/categories : retourne les sous-dossiers (catégories)
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

// 🔐 POST /media/category : créer une nouvelle catégorie
router.post('/category', verifyToken, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom de catégorie requis' });

    const safeName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/gi, '');
    const categoryPath = path.join(uploadsPath, safeName);

    try {
        if (fs.existsSync(categoryPath)) {
            return res.status(409).json({ error: 'Catégorie déjà existante' });
        }

        fs.mkdirSync(categoryPath, { recursive: true });
        return res.status(201).json({ message: 'Catégorie créée', category: safeName });
    } catch (err) {
        console.error('Erreur création catégorie', err);
        return res.status(500).json({ error: 'Erreur création catégorie' });
    }
});

// 🔐 DELETE /media/category : supprimer une catégorie (si vide)
router.delete('/category', verifyToken, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom de catégorie requis' });

    const categoryPath = path.join(uploadsPath, name);

    try {
        if (!fs.existsSync(categoryPath)) {
            return res.status(404).json({ error: 'Catégorie inexistante' });
        }

        const files = fs.readdirSync(categoryPath);
        if (files.length > 0) {
            return res.status(400).json({ error: 'Catégorie non vide' });
        }

        fs.rmdirSync(categoryPath);
        return res.json({ message: 'Catégorie supprimée' });
    } catch (err) {
        console.error('Erreur suppression catégorie', err);
        return res.status(500).json({ error: 'Erreur suppression catégorie' });
    }
});

// 🔓 GET /media/random-image : image aléatoire globale ou d’un style
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
                walk(fullPath);
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

// 🔐 DELETE /media : supprimer un média (protégé)
router.delete('/', verifyToken, (req, res) => {
    const { file, category } = req.body;
    if (!file || !category) {
        return res.status(400).json({ error: 'Fichier ou catégorie manquant' });
    }

    const filePath = path.join(uploadsPath, category, file);

    try {
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Fichier introuvable' });
        }

        fs.unlinkSync(filePath);
        res.json({ message: 'Fichier supprimé avec succès' });
    } catch (err) {
        console.error('Erreur suppression fichier', err);
        res.status(500).json({ error: 'Erreur suppression' });
    }
});

module.exports = router;
