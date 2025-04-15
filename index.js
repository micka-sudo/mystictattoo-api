const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const uploadRoute = require('./routes/upload');
const authRoute = require('./routes/auth');
const mediaRoute = require('./routes/media');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// Dossier de fichiers uploadés
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Routes
app.use('/api/upload', uploadRoute);
app.use('/api/login', authRoute);
app.use('/api/media', mediaRoute);

app.get('/', (req, res) => {
    res.send('🚀 Backend Mystic Tattoo en ligne');
});

app.listen(PORT, () => {
    console.log(`✅ Serveur backend démarré sur http://localhost:${PORT}`);
});
