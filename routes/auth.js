const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const verifyToken = require('../middlewares/auth');

const router = express.Router();
const configPath = path.join(__dirname, '..', 'config', 'admin.json');

// 📂 Récupère le hash actuel du fichier JSON
const getPasswordHash = () => {
    const raw = fs.readFileSync(configPath);
    return JSON.parse(raw).passwordHash;
};

// 📝 Sauvegarde un nouveau hash dans le fichier
const savePasswordHash = (hash) => {
    fs.writeFileSync(configPath, JSON.stringify({ passwordHash: hash }, null, 2));
};

// 🔐 Connexion
router.post('/', async (req, res) => {
    const { password } = req.body;
    const hash = getPasswordHash();
    const isMatch = await bcrypt.compare(password, hash);

    if (!isMatch) return res.status(401).json({ error: 'Mot de passe incorrect' });

    const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '30m' }); // expire dans 30 minutes
    res.json({ token });
});

// 🔁 Rafraîchissement du token (frontend appelle cette route avec le token actuel)
router.post('/refresh-token', (req, res) => {
    const { token } = req.body;

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Génère un nouveau token valide pour 30 min
        const newToken = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '30m' });

        res.json({ token: newToken });
    } catch (err) {
        console.warn('❌ Token invalide ou expiré');
        res.status(401).json({ error: 'Token expiré ou invalide' });
    }
});

// 🔐 Changement de mot de passe
router.put('/change-password', verifyToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const hash = getPasswordHash();
    const isMatch = await bcrypt.compare(currentPassword, hash);
    if (!isMatch) return res.status(401).json({ error: 'Ancien mot de passe incorrect' });

    const newHash = await bcrypt.hash(newPassword, 10);
    savePasswordHash(newHash);
    res.json({ message: 'Mot de passe mis à jour avec succès.' });
});

module.exports = router;
