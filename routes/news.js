const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const verifyToken = require('../middlewares/auth');

const router = express.Router();
const filePath = path.join(__dirname, '..', 'data', 'news.json');
const uploadsBasePath = path.join(__dirname, '..', 'uploads');
const newsUploadsPath = path.join(uploadsBasePath, 'news');

// Initialise le fichier news.json s’il n’existe pas
if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '[]');
} else {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        JSON.parse(content);
    } catch (err) {
        console.warn('⚠️ news.json corrompu : réinitialisation automatique');
        fs.writeFileSync(filePath, '[]');
    }
}

// Lecture des actualités
const readNews = () => {
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return data ? JSON.parse(data) : [];
    } catch (err) {
        console.error('❌ Erreur lecture JSON:', err);
        return [];
    }
};

// Écriture dans le fichier
const writeNews = (data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// Configuration Multer pour les images
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdirSync(newsUploadsPath, { recursive: true });
        cb(null, newsUploadsPath);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const baseName = path.basename(file.originalname, ext).replace(/\s+/g, '-');
        const name = `${baseName}-${Date.now()}-${Math.floor(Math.random() * 1e9)}.jpg`;
        cb(null, name);
    },
});
const upload = multer({ storage });

// Optimisation de l’image avec sharp
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
        console.error('❌ Erreur conversion JPEG actus :', err.message);
    }
};

// GET /news : liste des actualités
router.get('/', (req, res) => {
    const data = readNews();
    res.json(data);
});

// POST /news : créer une actualité (JSON ou multipart)
router.post('/', verifyToken, upload.single('image'), async (req, res) => {
    const body = req.body || {};
    const title = body.title;
    const content = body.content;
    const isVisible =
        body.isVisible === undefined ||
        body.isVisible === 'true' ||
        body.isVisible === true;
    if (!title || !content) {
        return res
            .status(400)
            .json({ error: 'Champs requis : title et content' });
    }
    let imagePath = '';
    try {
        if (req.file) {
            await convertToOptimizedJpeg(req.file.path);
            imagePath = `/uploads/news/${req.file.filename}`;
        } else if (body.image) {
            imagePath = body.image;
        }
    } catch (err) {
        console.error('❌ Erreur traitement de l\'image pour actu :', err);
    }

    const data = readNews();
    const newItem = {
        id: Date.now(),
        title,
        content,
        image: imagePath || '',
        isVisible,
        createdAt: new Date().toISOString(),
    };
    data.push(newItem);
    writeNews(data);
    res.status(201).json(newItem);
});

// PUT /news/:id : mise à jour d’une actualité
router.put('/:id', verifyToken, upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};
    const title = body.title;
    const content = body.content;
    const hasNewFile = !!req.file;
    let newImagePath;

    const data = readNews();
    const index = data.findIndex((item) => item.id == id);
    if (index === -1)
        return res.status(404).json({ error: 'Actualité non trouvée' });

    if (hasNewFile) {
        try {
            await convertToOptimizedJpeg(req.file.path);
            newImagePath = `/uploads/news/${req.file.filename}`;
        } catch (err) {
            console.error('❌ Erreur traitement de l\'image de mise à jour actu :', err);
        }
    }

    const current = data[index];
    data[index] = {
        ...current,
        title: title || current.title,
        content: content || current.content,
        image:
            newImagePath !== undefined
                ? newImagePath
                : body.image !== undefined
                    ? body.image
                    : current.image,
    };
    writeNews(data);
    res.json(data[index]);
});

// DELETE /news/:id : supprimer une actualité
router.delete('/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const data = readNews();
    const index = data.findIndex((item) => item.id == id);
    if (index === -1)
        return res.status(404).json({ error: 'Actualité non trouvée' });
    const deleted = data.splice(index, 1);
    writeNews(data);
    res.json(deleted[0]);
});

module.exports = router;
