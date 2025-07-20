const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config();

// 🧭 Routes
const routes = require('./routes');
const sitemapRoute = require('./routes/sitemap');
const robotsRoute = require('./routes/robots');

// 🧾 Configuration admin pour la page d'accueil
const adminConfigPath = path.join(__dirname, 'config', 'admin.json');

// 📁 Chemins
const uploadsPath = path.join(__dirname, 'uploads');
const frontendPath = path.join(__dirname, 'client', 'build');

const app = express();
const PORT = process.env.PORT || 4000;

// 🌐 CORS — Frontend autorisé
const allowedOrigins = [
    'http://localhost:3000',
    'https://mystictattoo-chat.vercel.app',
    'https://www.mystic-tattoo.fr'
];
app.use(cors({ origin: allowedOrigins, credentials: true }));

// 🔌 Middleware JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔌 Connexion MongoDB
// 🔌 Connexion MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ Connexion MongoDB établie'))
    .catch(err => console.error('❌ Connexion MongoDB échouée :', err));


// 📂 Serveur de fichiers uploadés
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// 🔁 Routes API (automatiquement regroupées dans /routes/index.js)
app.use('/api', routes);

// 🌍 SEO — sitemap & robots
app.use('/', sitemapRoute); // ➜ /sitemap.xml
app.use('/', robotsRoute);  // ➜ /robots.txt

// ⚛️ Intégration frontend React (client/build)
if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));

    // 🌐 Fallback React Router (toutes les routes non-API)
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
} else {
    console.warn('⚠️ Frontend non trouvé dans /client/build');
}

// 🧪 Route de test simple
app.get('/ping', (req, res) => {
    res.send('🚀 Backend Mystic Tattoo opérationnel');
});

// 🧯 Middleware d'erreur global
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
        console.warn('⚠️ admin.json introuvable ou invalide');
    }

    console.log(`✅ Serveur en ligne sur http://localhost:${PORT}`);
    console.log(`📰 Actualités d’accueil : ${showNews}`);
});
