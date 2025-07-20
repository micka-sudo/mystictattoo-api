const express = require('express');
const fs = require('fs');
const path = require('path');
const verifyToken = require('../middlewares/auth'); // ⚠️ nécessite token pour écrire

const router = express.Router();
const configPath = path.join(__dirname, '..', 'config', 'admin.json');

// 🔓 GET /api/config — lire la config admin
router.get('/', (req, res) => {
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        res.json(config);
    } catch (err) {
        console.error('❌ Erreur lecture admin.json :', err);
        res.status(500).json({ error: 'Erreur lecture configuration' });
    }
});

// 🔐 POST /api/config — modifier la config admin (auth requise)
router.post('/', verifyToken, (req, res) => {
    try {
        fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2));
        res.json({ message: '✅ Configuration mise à jour' });
    } catch (err) {
        console.error('❌ Erreur écriture admin.json :', err);
        res.status(500).json({ error: 'Erreur écriture configuration' });
    }
});

module.exports = router;
