// models/Media.js
const mongoose = require("mongoose");

/**
 * Schéma des médias (images / vidéos)
 * Stocke à la fois :
 *  - le chemin local (path)
 *  - l'URL Cloudinary (cloudUrl)
 */
const mediaSchema = new mongoose.Schema(
    {
        // Nom du fichier (ex: mon-tattoo-123.opt.webp)
        filename: {
            type: String,
            required: true,
            trim: true,
        },

        // Chemin local côté serveur (ex: /uploads/Tattoo noir et blanc/mon-tattoo.opt.webp)
        path: {
            type: String,
            required: true,
            trim: true,
        },

        // Catégorie (style / dossier) : "Tattoo noir et blanc", "Flash", etc.
        category: {
            type: String,
            required: true,
            trim: true,
        },

        // Type de média : image ou vidéo
        type: {
            type: String,
            enum: ["image", "video"],
            required: true,
        },

        // Tags éventuels (pour le futur : SEO, filtres…)
        tags: {
            type: [String],
            default: [],
        },

        /**
         * URL Cloudinary du fichier (hébergement distant)
         * Exemple :
         *  https://res.cloudinary.com/xxxx/image/upload/v123456/mystic/Tattoo noir et blanc/mon-tattoo.opt.webp
         * C'est cette valeur qui est renvoyée au front sous le nom "cloudinaryUrl".
         */
        cloudUrl: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true, // createdAt / updatedAt
    }
);

module.exports = mongoose.model("Media", mediaSchema);
