const express = require('express');
const router = express.Router();
require('dotenv').config();

// 📁 Routes API individuelles

router.use('/login', require('./auth'));            // Authentification admin (JWT)
router.use('/media', require('./media'));           // Gestion des médias (upload, DB, optimisé web)
router.use('/news', require('./news'));             // Actualités (affichées sur la home)
router.use('/reservations', require('./reservation'));// Réservations (à venir)
router.use('/config', require('./config'));         // Configuration admin.json

module.exports = router;
