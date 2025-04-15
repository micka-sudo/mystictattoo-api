const express = require('express');
const multer = require('multer');
const path = require('path');
const verifyToken = require('../middlewares/auth');

const router = express.Router();

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads');
    },
    filename: function (req, file, cb) {
        const unique = Date.now() + '-' + file.originalname;
        cb(null, unique);
    },
});

const upload = multer({ storage });

// ✅ Cette route nécessite un token valide
router.post('/', verifyToken, upload.single('file'), (req, res) => {
    const { category, tags } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: 'Fichier manquant' });

    const fileType = file.mimetype.startsWith('image') ? 'image' : 'video';

    const mediaItem = {
        file: file.filename,
        url: '/uploads/' + file.filename,
        type: fileType,
        category,
        tags: tags ? tags.split(',').map(t => t.trim()) : []
    };

    res.status(201).json(mediaItem);
});

module.exports = router;
