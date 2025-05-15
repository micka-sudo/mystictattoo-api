const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const configPath = path.join(__dirname, '../config/admin.json');

// 🔓 GET /api/config/home
router.get('/home', (req, res) => {
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        res.json({ showNewsOnHome: config.showNewsOnHome ?? true });
    } catch (err) {
        console.error('Erreur lecture config', err);
        res.status(500).json({ error: 'Erreur lecture config' });
    }
});

// 🔐 PUT /api/config/home
router.put('/home', (req, res) => {
    const { showNewsOnHome } = req.body;

    if (typeof showNewsOnHome !== 'boolean') {
        return res.status(400).json({ error: 'Valeur booléenne requise' });
    }

    try {
        const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const newConfig = { ...currentConfig, showNewsOnHome };
        fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
        res.json({ message: 'Configuration mise à jour', showNewsOnHome });
    } catch (err) {
        console.error('Erreur écriture config', err);
        res.status(500).json({ error: 'Erreur écriture config' });
    }
});

module.exports = router;
