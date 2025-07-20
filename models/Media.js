const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
    filename: String,          // Nom du fichier
    path: String,              // Chemin dans /uploads
    category: String,          // Catégorie (dossier)
    type: String,              // image | video
    tags: [String],            // Étiquettes facultatives
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Media', mediaSchema);
