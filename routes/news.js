const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const filePath = path.join(__dirname, '..', 'data', 'news.json');

// Assure que le fichier existe
if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '[]');

// Lire toutes les actualités
router.get('/', (req, res) => {
    const data = JSON.parse(fs.readFileSync(filePath));
    res.json(data);
});

// Créer une actu
router.post('/', (req, res) => {
    const { title, content, image } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Champs manquants' });

    const data = JSON.parse(fs.readFileSync(filePath));
    const newItem = {
        id: Date.now(),
        title,
        content,
        image: image || ''
    };
    data.push(newItem);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.status(201).json(newItem);
});

// Modifier une actu
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { title, content } = req.body;
    const data = JSON.parse(fs.readFileSync(filePath));

    const index = data.findIndex(item => item.id == id);
    if (index === -1) return res.status(404).json({ error: 'Actu non trouvée' });

    data[index] = { ...data[index], title, content };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.json(data[index]);
});

// Supprimer une actu
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    let data = JSON.parse(fs.readFileSync(filePath));
    const index = data.findIndex(item => item.id == id);
    if (index === -1) return res.status(404).json({ error: 'Actu non trouvée' });

    const deleted = data.splice(index, 1);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.json(deleted[0]);
});

module.exports = router;
