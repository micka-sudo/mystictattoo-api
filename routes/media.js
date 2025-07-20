const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const Media = require('../models/Media');
const verifyToken = require('../middlewares/auth');

const router = express.Router();
const uploadsPath = path.join(__dirname, '..', 'uploads');

// 📦 Multer : configuration du stockage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const category = req.body.category || 'uncategorized';
        const dir = path.join(uploadsPath, category);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const baseName = path.basename(file.originalname, ext).replace(/\s+/g, '-');
        const name = `${baseName}-${Date.now()}-${Math.floor(Math.random() * 1e9)}.jpg`;
        cb(null, name);
    }
});
const upload = multer({ storage });

// 🔧 Convertit une image vers JPEG optimisé (qualité web)
const convertToOptimizedJpeg = async (filePath) => {
    try {
        await sharp(filePath)
            .rotate()
            .resize(1920, null, { withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toFile(filePath + '.jpg');

        fs.unlinkSync(filePath);
        fs.renameSync(filePath + '.jpg', filePath);
    } catch (err) {
        console.error(`❌ Erreur conversion JPEG :`, err.message);
    }
};

// 🔐 POST /media/upload — Upload d’un fichier + enregistrement BDD
router.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier envoyé' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    const isImage = /\.(jpg|jpeg|png|webp|heic|tiff|bmp|avif)$/i.test(ext);
    const fullPath = req.file.path;

    try {
        if (isImage) await convertToOptimizedJpeg(fullPath);

        const newMedia = await Media.create({
            filename: req.file.filename,
            path: `/uploads/${req.body.category}/${req.file.filename}`,
            category: req.body.category,
            type: isImage ? 'image' : 'video',
            tags: []
        });

        res.status(201).json({ ...newMedia.toObject(), url: newMedia.path });
    } catch (err) {
        console.error('❌ Erreur upload ou BDD', err);
        res.status(500).json({ error: 'Erreur traitement fichier' });
    }
});

// 🔓 GET /media — Liste des médias
router.get('/', async (req, res) => {
    const filter = req.query.style ? { category: req.query.style } : {};
    try {
        const media = await Media.find(filter).sort({ createdAt: -1 });
        const withUrl = media.map(m => ({ ...m.toObject(), url: m.path }));
        res.json(withUrl);
    } catch (err) {
        res.status(500).json({ error: 'Erreur lecture BDD' });
    }
});

// 🔐 DELETE /media/:id — Supprime fichier physique + base
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const media = await Media.findById(req.params.id);
        if (!media) return res.status(404).json({ error: 'Média introuvable' });

        const filePath = path.join(uploadsPath, media.category, media.filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        await Media.findByIdAndDelete(req.params.id);
        res.json({ message: 'Média supprimé' });
    } catch (err) {
        res.status(500).json({ error: 'Erreur suppression média' });
    }
});

// 🔁 PATCH /media/:id/move — Déplace une image dans une autre catégorie
router.patch('/:id/move', verifyToken, async (req, res) => {
    const { newCategory } = req.body;
    if (!newCategory) return res.status(400).json({ error: 'Nouvelle catégorie requise' });

    try {
        const media = await Media.findById(req.params.id);
        if (!media) return res.status(404).json({ error: 'Média introuvable' });

        const oldPath = path.join(uploadsPath, media.category, media.filename);
        const newDir = path.join(uploadsPath, newCategory);
        const newPath = path.join(newDir, media.filename);

        fs.mkdirSync(newDir, { recursive: true });
        fs.renameSync(oldPath, newPath);

        media.category = newCategory;
        media.path = `/uploads/${newCategory}/${media.filename}`;
        await media.save();

        res.json({ message: 'Média déplacé', media: { ...media.toObject(), url: media.path } });
    } catch (err) {
        console.error('❌ Erreur déplacement média :', err);
        res.status(500).json({ error: 'Erreur déplacement média' });
    }
});

// 🔓 GET /media/categories — Liste des catégories
router.get('/categories', async (req, res) => {
    try {
        const categories = await Media.distinct('category');
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: 'Erreur lecture catégories' });
    }
});

// 🔓 GET /media/categories-with-content — Catégories avec contenu
router.get('/categories-with-content', async (req, res) => {
    try {
        const categories = await Media.distinct('category');
        res.json(categories);
    } catch (err) {
        console.error('❌ Erreur lecture catégories avec contenu', err);
        res.status(500).json({ error: 'Erreur lecture catégories' });
    }
});

// 🔓 GET /media/random — Image aléatoire
router.get('/random', async (req, res) => {
    try {
        const query = req.query.style ? { category: req.query.style } : { type: 'image' };
        const count = await Media.countDocuments(query);
        const random = await Media.findOne(query).skip(Math.floor(Math.random() * count));
        if (!random) return res.status(404).json({ error: 'Aucune image trouvée' });

        res.json({ url: random.path });
    } catch (err) {
        res.status(500).json({ error: 'Erreur image aléatoire' });
    }
});

module.exports = router;
