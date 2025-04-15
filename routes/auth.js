const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();
const SECRET_KEY = 'tonSecretUltraFort'; // 🔐 à sécuriser dans un .env

const ADMIN_PASSWORD = 'admin123'; // 🛠️ à sécuriser aussi (exemple temporaire)

// ✅ Route POST /api/login
router.post('/', (req, res) => {
    const { password } = req.body;

    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    const token = jwt.sign({ role: 'admin' }, SECRET_KEY, { expiresIn: '2h' });
    res.json({ token });
});

module.exports = router;
