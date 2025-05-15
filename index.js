const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const routes = require('./routes');
const adminConfigPath = path.join(__dirname, 'config', 'admin.json');

const app = express();
const PORT = process.env.PORT || 4000;

// ✅ Domaines autorisés pour CORS
const allowedOrigins = [
    'http://localhost:3000',
    'https://mystictattoo-chat.vercel.app',
    'https://www.mystic-tattoo.fr'
];

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

// 📦 Middleware JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 📂 Fichiers upload statiques
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// 🔁 Routes API
app.use('/api', routes);

// 📦 Intégration frontend React (build dans /client/build)
const frontendPath = path.join(__dirname, 'client', 'build');
if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));

    // ✅ Fallback React Router : routes frontend non-API
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
} else {
    console.warn('⚠️ Aucun frontend React trouvé dans /client/build');
}

// 🧪 Route test API
app.get('/ping', (req, res) => {
    res.send('🚀 Backend Mystic Tattoo opérationnel');
});

// 🧯 Middleware d’erreur global
app.use((err, req, res, next) => {
    console.error('❌ Erreur serveur :', err);
    res.status(500).json({ error: 'Erreur serveur interne' });
});

// 🚀 Lancement serveur
app.listen(PORT, () => {
    let showNews = 'non chargé';
    try {
        const config = JSON.parse(fs.readFileSync(adminConfigPath, 'utf8'));
        showNews = config.showNewsOnHome ? '✅ affichées' : '❌ masquées';
    } catch (err) {
        console.warn('⚠️ admin.json introuvable ou invalide');
    }

    console.log(`✅ Serveur démarré : http://localhost:${PORT}`);
    console.log(`📰 Actualités d’accueil : ${showNews}`);
});
