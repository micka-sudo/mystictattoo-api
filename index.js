const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 4000;

// CORS sécurisé
const allowedOrigins = [
    'http://localhost:3000',
    'https://mystictattoo-chat.vercel.app'
];

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

app.use(express.json());

// Dossier pour les fichiers uploadés
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Routes API
app.use('/api', routes);

// Route test
app.get('/', (req, res) => {
    res.send('🚀 Backend Mystic Tattoo en ligne');
});

// Middleware gestion erreurs
app.use((err, req, res, next) => {
    console.error('❌ Erreur serveur :', err);
    res.status(500).json({ error: 'Erreur serveur interne' });
});

// Lancement serveur
app.listen(PORT, () => {
    console.log(`✅ Backend démarré sur http://localhost:${PORT}`);
});
