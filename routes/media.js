const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const sharp = require("sharp");
const Media = require("../models/Media");
const verifyToken = require("../middlewares/auth");
const cloudinary = require("../utils/cloudinary");

const router = express.Router();

// Chemin racine des uploads locaux
const uploadsPath = path.join(__dirname, "..", "uploads");

/**
 * Configuration Multer : stockage local par catégorie
 */
const storage = multer.diskStorage({
    // Dossier : /uploads/{category}
    destination: (req, file, cb) => {
        const category = req.body.category || "uncategorized";
        const dir = path.join(uploadsPath, category);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    // Nom de fichier : baseName-timestamp-random.ext
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const baseName = path
            .basename(file.originalname, ext)
            .replace(/\s+/g, "-")
            .replace(/[()]/g, "");
        const name = `${baseName}-${Date.now()}-${Math.floor(
            Math.random() * 1e9
        )}${ext}`;
        cb(null, name);
    },
});

const upload = multer({ storage });

/**
 * Convertit une image vers une version optimisée .opt.webp
 * - Rotation auto
 * - Resize max 1920px de large
 * - Qualité ~85
 *
 * @param {string} filePath - chemin local du fichier source
 * @returns {Promise<string>} - chemin du fichier optimisé
 */
const convertToWebP = async (filePath) => {
    const outputPath = filePath.replace(path.extname(filePath), ".opt.webp");

    await sharp(filePath)
        .rotate()
        .resize(1920, null, { withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(outputPath);

    return outputPath;
};

/**
 * POST /media/upload
 * Upload d'un média :
 * - Enregistrement local dans /uploads/{category}
 * - Si image : conversion en .opt.webp + upload sur Cloudinary
 * - Si vidéo : stockage local uniquement (dans cette version)
 */
router.post("/upload", verifyToken, upload.single("file"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Aucun fichier envoyé" });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const isImage = /\.(jpg|jpeg|png|webp|heic|tiff|bmp|avif)$/i.test(ext);
    const fullPath = req.file.path;
    const category = req.body.category || "uncategorized";

    try {
        let finalFilename = req.file.filename;
        let fileUrl = `/uploads/${category}/${finalFilename}`;
        let cloudUrl = null;
        let type = isImage ? "image" : "video";

        if (isImage) {
            // 1) Génération de la version optimisée .opt.webp
            const optimizedPath = await convertToWebP(fullPath);
            const optimizedName = path.basename(optimizedPath);

            finalFilename = optimizedName;
            fileUrl = `/uploads/${category}/${optimizedName}`;

            // 2) Upload sur Cloudinary
            const cloudRes = await cloudinary.uploader.upload(optimizedPath, {
                folder: `mystic/${category}`,
                public_id: optimizedName.replace(".webp", ""),
                resource_type: "image",
            });
            cloudUrl = cloudRes.secure_url;
        }

        // Enregistrement en BDD
        const newMedia = await Media.create({
            filename: finalFilename,
            path: fileUrl,
            category,
            type, // "image" ou "video"
            cloudUrl,
            tags: [],
        });

        const obj = newMedia.toObject();

        // On renvoie :
        // - path : chemin local
        // - url : alias (compat front)
        // - cloudinaryUrl : alias pour cloudUrl
        res.status(201).json({
            ...obj,
            url: obj.path,
            cloudinaryUrl: obj.cloudUrl || null,
        });
    } catch (err) {
        console.error("❌ Erreur traitement fichier :", err);
        res.status(500).json({ error: "Erreur upload ou BDD" });
    }
});

/**
 * GET /media
 * Liste les médias.
 * - Si ?style=Catégorie → filtre par catégorie
 * - Trie par createdAt desc
 * - Supprime les doublons visuels (même base de nom)
 *   avec priorité au .opt.webp
 */
router.get("/", async (req, res) => {
    const filter = req.query.style ? { category: req.query.style } : {};

    try {
        const media = await Media.find(filter).sort({ createdAt: -1 });

        console.log("🔍 Médias trouvés :", media.length);
        if (media[0]) {
            console.log("🔍 Premier média brut :", media[0]);
        }

        // Suppression des doublons d'affichage :
        // priorité aux .opt.webp, puis .webp, puis jpg/jpeg/png/heic/mp4
        const seen = new Set();
        const filtered = media.filter((item) => {
            const base = item.filename
                .toLowerCase()
                .replace(/\.(opt\.webp|webp|jpg|jpeg|png|heic|mp4)$/i, "");
            if (seen.has(base)) return false;
            seen.add(base);
            return true;
        });

        const result = filtered.map((m) => {
            const obj = m.toObject();
            return {
                ...obj,
                url: obj.path,
                cloudinaryUrl: obj.cloudUrl || null,
            };
        });

        console.log("📤 Données envoyées :", result.length, "items");
        if (result[0]) {
            console.log("📤 Premier item envoyé :", result[0]);
        }

        res.json(result);
    } catch (err) {
        console.error("❌ Erreur /media :", err);
        res.status(500).json({ error: "Erreur lecture BDD" });
    }
});

/**
 * GET /media/categories
 * Liste toutes les catégories présentes en BDD (sans filtrage).
 */
router.get("/categories", async (req, res) => {
    try {
        const categories = await Media.distinct("category");
        console.log("📂 Catégories trouvées :", categories);
        res.json(categories);
    } catch (err) {
        console.error("❌ Erreur /categories :", err);
        res.status(500).json({ error: "Erreur lecture catégories" });
    }
});

/**
 * GET /media/categories-with-content
 * Liste les catégories qui ont au moins 1 média.
 * (Utilisé par useCategories côté front)
 */
router.get("/categories-with-content", async (req, res) => {
    try {
        const categories = await Media.distinct("category");
        console.log("📂 Toutes les catégories :", categories);

        const categoriesWithContent = [];
        for (const cat of categories) {
            const count = await Media.countDocuments({ category: cat });
            console.log(`📊 Catégorie "${cat}" : ${count} médias`);
            if (count > 0) {
                categoriesWithContent.push(cat);
            }
        }

        console.log("✅ Catégories avec contenu :", categoriesWithContent);
        res.json(categoriesWithContent);
    } catch (err) {
        console.error("❌ Erreur /categories-with-content :", err);
        res.status(500).json({ error: "Erreur lecture catégories" });
    }
});

/**
 * GET /media/random
 * Retourne UNE image aléatoire pour la page d'accueil :
 * - exclut les catégories "Flash" et "actus"
 * - ne renvoie que des images (type === "image")
 */
router.get("/random", async (req, res) => {
    try {
        console.log("📸 [API] /media/random");

        // Filtre : pas Flash / flash / FLASH ni actus
        const baseFilter = {
            category: {
                $nin: ["Flash", "flash", "FLASH", "actus", "Actus", "ACTUS"],
            },
            type: "image", // uniquement les images
        };

        const count = await Media.countDocuments(baseFilter);
        console.log("📸 [API] /media/random → count =", count);

        if (!count) {
            return res.status(404).json({ error: "Aucune image disponible" });
        }

        const randomIndex = Math.floor(Math.random() * count);
        const mediaDoc = await Media.findOne(baseFilter)
            .skip(randomIndex)
            .lean();

        if (!mediaDoc) {
            return res
                .status(404)
                .json({ error: "Image aléatoire introuvable" });
        }

        // On choisit le meilleur chemin :
        // on part du principe que `path` contient déjà la version optimisée
        const preferredPath =
            mediaDoc.path ||
            mediaDoc.url || // au cas où
            mediaDoc.filename
                ? `/uploads/${mediaDoc.category}/${mediaDoc.filename}`
                : "";

        console.log("📸 [API] /media/random → media choisi :", {
            _id: mediaDoc._id,
            category: mediaDoc.category,
            preferredPath,
        });

        // Réponse compatible avec Home.js (buildMediaUrl)
        return res.json({
            ...mediaDoc,
            path: preferredPath,
            url: preferredPath,
            cloudinaryUrl: mediaDoc.cloudUrl || null,
        });
    } catch (err) {
        console.error("❌ [API] /media/random → Erreur serveur :", err);
        return res
            .status(500)
            .json({ error: "Erreur serveur sur /media/random" });
    }
});

module.exports = router;
