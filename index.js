const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// 👇 Routes
const routes = require('./routes');
const adminConfigPath = path.join(__dirname, 'config', 'admin.json');

const app = express();
const PORT = process.env.PORT || 4000;

// ✅ Origines autorisées (inclure le domaine personnalisé)
const allowedOrigins = [
    'http://localhost:3000',
    'https://mystictattoo-chat.vercel.app',
    'https://www.mystic-tattoo.fr'
];

// 🔐 Middleware CORS
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

// 📦 Support JSON
app.use(express.json());

// 📂 Statique : /uploads
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// 🔁 Routes API
app.use('/api', routes);

// 🧪 Route test
app.get('/', (req, res) => {
    res.send('🚀 Backend Mystic Tattoo en ligne');
});

// ⚠️ Gestion des erreurs globales
app.use((err, req, res, next) => {
    console.error('❌ Erreur serveur :', err);
    res.status(500).json({ error: 'Erreur serveur interne' });
});

// 🚀 Lancement du serveur
app.listen(PORT, () => {
    let showNews = 'non chargé';
    try {
        const config = JSON.parse(fs.readFileSync(adminConfigPath, 'utf8'));
        showNews = config.showNewsOnHome ? '✅ affichées' : '❌ masquées';
    } catch (err) {
        console.warn('⚠️ Impossible de lire la config admin.json');
    }

    console.log(`✅ Backend démarré : http://localhost:${PORT}`);
    console.log(`📰 Actualités sur la page d’accueil : ${showNews}`);
});
