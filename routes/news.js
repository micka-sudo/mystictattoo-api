const express = require('express');
const fs = require('fs');
const path = require('path');
const verifyToken = require('../middlewares/auth'); // si tu veux protéger la création/modif

const router = express.Router();
const filePath = path.join(__dirname, '..', 'data', 'news.json');

// 🔧 Initialiser le fichier s'il n'existe pas
if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '[]');

// 🔁 Fonction utilitaire pour lire le fichier JSON
const readNews = () => {
    try {
        const data = fs.readFileSync(filePath);
        return JSON.parse(data);
    } catch (err) {
        console.error('❌ Erreur lecture JSON:', err);
        return [];
    }
};

// 💾 Fonction pour écrire dans le fichier JSON
const writeNews = (data) => {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};

// ✅ GET /news : lire toutes les actualités
router.get('/', (req, res) => {
    const data = readNews();
    res.json(data);
});

// ✅ POST /news : créer une actualité (protégé si besoin)
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

// ✅ PUT /news/:id : modifier une actu existante
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

// ✅ DELETE /news/:id : supprimer une actu
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
