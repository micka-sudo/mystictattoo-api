const express = require('express');
const fs = require('fs');
const path = require('path');
const verifyToken = require('../middlewares/auth');

const router = express.Router();
const filePath = path.join(__dirname, '..', 'data', 'news.json');

// 🔧 Initialiser le fichier s'il n'existe pas ou est invalide
if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '[]');
} else {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        JSON.parse(content); // déclenche une erreur si invalide
    } catch (err) {
        console.warn('⚠️ news.json corrompu : réinitialisation automatique');
        fs.writeFileSync(filePath, '[]');
    }
}

// 🔁 Lecture des actualités
const readNews = () => {
    try {
        const data = fs.readFileSync(filePath, 'utf-8');
        return data ? JSON.parse(data) : [];
    } catch (err) {
        console.error('❌ Erreur lecture JSON:', err);
        return [];
    }
};

// 💾 Écriture dans le fichier
const writeNews = (data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// ✅ GET /news : lire toutes les actus
router.get('/', (req, res) => {
    const data = readNews();
    res.json(data);
});

// ✅ POST /news : créer une actu
router.post('/', verifyToken, (req, res) => {
    const { title, content, image } = req.body;
    if (!title || !content) {
        return res.status(400).json({ error: 'Champs requis : title et content' });
    }

    const data = readNews();
    const newItem = {
        id: Date.now(),
        title,
        content,
        image: image || '',
        createdAt: new Date().toISOString()
    };

    data.push(newItem);
    writeNews(data);
    res.status(201).json(newItem);
});

// ✅ PUT /news/:id : modifier une actu
router.put('/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const { title, content, image } = req.body;

    const data = readNews();
    const index = data.findIndex(item => item.id == id);
    if (index === -1) return res.status(404).json({ error: 'Actualité non trouvée' });

    data[index] = {
        ...data[index],
        title: title || data[index].title,
        content: content || data[index].content,
        image: image !== undefined ? image : data[index].image
    };

    writeNews(data);
    res.json(data[index]);
});

// ✅ DELETE /news/:id
router.delete('/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const data = readNews();

    const index = data.findIndex(item => item.id == id);
    if (index === -1) return res.status(404).json({ error: 'Actualité non trouvée' });

    const deleted = data.splice(index, 1);
    writeNews(data);
    res.json(deleted[0]);
});

module.exports = router;
