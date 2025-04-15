const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const baseDir = path.join(__dirname, '../uploads');

// ✅ GET /api/media → retourne tous les fichiers avec catégorie et type
router.get('/', (req, res) => {
    const result = [];

    if (!fs.existsSync(baseDir)) return res.json([]);

    const categories = fs.readdirSync(baseDir);

    categories.forEach((cat) => {
        const catPath = path.join(baseDir, cat);
        if (fs.lstatSync(catPath).isDirectory()) {
            const files = fs.readdirSync(catPath).map((file) => ({
                file,
                category: cat,
                type: /\.(mp4|webm)$/i.test(file) ? 'video' : 'image',
                url: `/uploads/${cat}/${file}`,
            }));
            result.push(...files);
        }
    });

    res.json(result);
});

// ✅ GET /api/media/categories → retourne les noms de dossiers (catégories)
router.get('/categories', (req, res) => {
    if (!fs.existsSync(baseDir)) return res.json([]);

    const categories = fs
        .readdirSync(baseDir)
        .filter((dir) => fs.lstatSync(path.join(baseDir, dir)).isDirectory());

    res.json(categories);
});

// ✅ GET /api/media/random-image → retourne une image aléatoire
router.get('/random-image', (req, res) => {
    if (!fs.existsSync(baseDir)) return res.status(404).json({ error: 'uploads folder not found' });

    const allFiles = [];

    const categories = fs.readdirSync(baseDir);
    categories.forEach((cat) => {
        const catPath = path.join(baseDir, cat);
        if (fs.lstatSync(catPath).isDirectory()) {
            const files = fs.readdirSync(catPath)
                .filter((f) => /\.(jpe?g|png|webp|jpeg)$/i.test(f)) // ✅ filtre images
                .map((file) => `/uploads/${cat}/${file}`);
            allFiles.push(...files);
        }
    });

    if (allFiles.length === 0) return res.status(404).json({ error: 'no image found' });

    const random = allFiles[Math.floor(Math.random() * allFiles.length)];
    res.json({ url: random });
});

module.exports = router;
