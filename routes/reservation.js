const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const filePath = path.join(__dirname, '..', 'data', 'reservations.json');

// S'assurer que le fichier existe
if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '[]');

// ✅ Lire toutes les réservations
router.get('/', (req, res) => {
    const data = JSON.parse(fs.readFileSync(filePath));
    res.json(data);
});

// ✅ Créer une nouvelle réservation
router.post('/', (req, res) => {
    const { name, email, message, date } = req.body;
    if (!name || !email || !date) {
        return res.status(400).json({ error: 'Champs requis manquants' });
    }

    const data = JSON.parse(fs.readFileSync(filePath));
    const newResa = {
        id: Date.now(),
        name,
        email,
        message: message || '',
        date,
        status: 'en attente' // 🔁 nouveau champ ajouté automatiquement
    };

    data.push(newResa);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.status(201).json(newResa);
});

// ✅ Mettre à jour le statut d'une réservation
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const data = JSON.parse(fs.readFileSync(filePath));
    const index = data.findIndex(item => item.id == id);
    if (index === -1) return res.status(404).json({ error: 'Réservation non trouvée' });

    data[index].status = status;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    res.json(data[index]);
});

module.exports = router;
