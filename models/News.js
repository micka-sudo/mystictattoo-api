// models/News.js
const mongoose = require('mongoose');

const NewsSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        content: { type: String, required: true, trim: true },
        // Chemin du fichier image (ex: /uploads/news/xxx.jpg)
        image: { type: String, default: null },
    },
    { timestamps: true }
);

module.exports = mongoose.model('News', NewsSchema);
