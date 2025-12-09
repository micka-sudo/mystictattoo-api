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
 * Multer : stockage local par catégorie
 */
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const category = req.body.category || "uncategorized";
        const dir = path.join(uploadsPath, category);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
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
 * Extrait le public_id Cloudinary à partir de l'URL sécurisée
 * ex: https://res.cloudinary.com/.../upload/v123456/mystic/Tattoo noir et blanc/monimage.opt.webp
 *  → public_id = "mystic/Tattoo noir et blanc/monimage.opt"
 */
const getCloudinaryPublicId = (cloudUrl) => {
    if (!cloudUrl) return null;
    try {
        const match = cloudUrl.match(
            /\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/
        );
        return match ? match[1] : null;
    } catch (e) {
        console.error("❌ Impossible d'extraire public_id Cloudinary :", e);
        return null;
    }
};

/**
 * POST /media/upload
 * Upload d'un média (image/vidéo) :
 * - Enregistrement local
 * - Conversion .opt.webp pour les images
 * - Upload Cloudinary (images)
 * - Enregistrement MongoDB
 */
router.post(
    "/upload",
    verifyToken,
    upload.single("file"),
    async (req, res) => {
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
                const optimizedPath = await convertToWebP(fullPath);
                const optimizedName = path.basename(optimizedPath);

                finalFilename = optimizedName;
                fileUrl = `/uploads/${category}/${optimizedName}`;

                console.log("▶️ UPLOAD IMAGE → envoi à Cloudinary...", {
                    category,
                    optimizedPath,
                });

                try {
                    const cloudRes = await cloudinary.uploader.upload(optimizedPath, {
                        folder: `mystic/${category}`,
                        public_id: optimizedName.replace(".webp", ""),
                        resource_type: "image",
                    });

                    console.log("☁️ Cloudinary upload OK :", cloudRes.secure_url);
                    cloudUrl = cloudRes.secure_url;
                } catch (cloudErr) {
                    console.error("❌ Cloudinary ERROR:", cloudErr);
                    // on continue quand même avec le fichier local + BDD
                }
            }

            const newMedia = await Media.create({
                filename: finalFilename,
                path: fileUrl,
                category,
                type,
                cloudUrl,
                tags: [],
            });

            const obj = newMedia.toObject();

            return res.status(201).json({
                ...obj,
                url: obj.path,
                cloudinaryUrl: obj.cloudUrl || null,
            });
        } catch (err) {
            console.error("❌ Erreur traitement fichier :", err);
            return res
                .status(500)
                .json({ error: "Erreur upload ou BDD" });
        }
    }
);

/**
 * GET /media
 * Liste des médias (optionnellement filtrés par ?style=catégorie)
 * + dédup visuelle : priorité .opt.webp > .webp > jpg/png/heic/mp4
 */
router.get("/", async (req, res) => {
    const filter = req.query.style
        ? { category: req.query.style }
        : {};

    try {
        const media = await Media.find(filter).sort({ createdAt: -1 });

        console.log("🔍 Médias trouvés :", media.length);

        const seen = new Map();

        const scoreExt = (filename = "") => {
            const f = filename.toLowerCase();
            if (f.endsWith(".opt.webp")) return 3;
            if (f.endsWith(".webp")) return 2;
            if (/\.(jpg|jpeg|png|heic)$/i.test(f)) return 1;
            if (f.endsWith(".mp4")) return 1;
            return 0;
        };

        for (const m of media) {
            const filename = (m.filename || "").toLowerCase();
            const base = filename.replace(
                /\.(opt\.webp|webp|jpg|jpeg|png|heic|mp4)$/i,
                ""
            );
            const currentScore = scoreExt(filename);
            const existing = seen.get(base);

            if (!existing || currentScore > existing._score) {
                seen.set(base, { doc: m, _score: currentScore });
            }
        }

        const filtered = Array.from(seen.values()).map(
            ({ doc }) => doc
        );

        const result = filtered.map((m) => {
            const obj = m.toObject();
            return {
                ...obj,
                url: obj.path,
                cloudinaryUrl: obj.cloudUrl || null,
            };
        });

        console.log("📤 Données envoyées :", result.length, "items");

        return res.json(result);
    } catch (err) {
        console.error("❌ Erreur /media :", err);
        return res
            .status(500)
            .json({ error: "Erreur lecture BDD" });
    }
});

/**
 * DELETE /media/:id
 * Supprime :
 * - l'entrée Mongo
 * - le fichier local (si présent)
 * - l'asset Cloudinary (si cloudUrl présent)
 */
router.delete("/:id", verifyToken, async (req, res) => {
    const { id } = req.params;

    try {
        const doc = await Media.findById(id);
        if (!doc) {
            return res.status(404).json({ error: "Média introuvable" });
        }

        // suppression Cloudinary si present
        if (doc.cloudUrl) {
            const publicId = getCloudinaryPublicId(doc.cloudUrl);
            if (publicId) {
                try {
                    await cloudinary.uploader.destroy(publicId, {
                        resource_type:
                            doc.type === "video" ? "video" : "image",
                    });
                    console.log(
                        "🧹 Cloudinary asset supprimé :",
                        publicId
                    );
                } catch (e) {
                    console.error(
                        "❌ Erreur suppression Cloudinary :",
                        e
                    );
                }
            }
        }

        // suppression fichier local si présent
        try {
            const filePath = path.join(
                uploadsPath,
                doc.category || "",
                doc.filename || ""
            );
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log("🧹 Fichier local supprimé :", filePath);
            }
        } catch (e) {
            console.error(
                "❌ Erreur suppression fichier local :",
                e
            );
        }

        await Media.findByIdAndDelete(id);

        return res.json({ success: true });
    } catch (err) {
        console.error("❌ Erreur DELETE /media/:id :", err);
        return res
            .status(500)
            .json({ error: "Erreur suppression média" });
    }
});

/**
 * PUT /media/:id/move
 * Déplace un média vers une autre catégorie
 * - met à jour la catégorie
 * - met à jour le path local
 * (Cloudinary : on laisse l'asset dans l'ancien dossier,
 *   l'URL reste valide → pas bloquant pour l'affichage)
 */
router.put("/:id/move", verifyToken, async (req, res) => {
    const { id } = req.params;
    const { newCategory } = req.body;

    if (!newCategory) {
        return res
            .status(400)
            .json({ error: "newCategory requis" });
    }

    try {
        const doc = await Media.findById(id);
        if (!doc) {
            return res.status(404).json({ error: "Média introuvable" });
        }

        const oldCategory = doc.category || "uncategorized";
        const filename = doc.filename || "";

        // déplacement du fichier local si présent
        try {
            const oldPath = path.join(uploadsPath, oldCategory, filename);
            const newDir = path.join(uploadsPath, newCategory);
            const newPath = path.join(newDir, filename);

            if (fs.existsSync(oldPath)) {
                fs.mkdirSync(newDir, { recursive: true });
                fs.renameSync(oldPath, newPath);
                console.log("📦 Fichier déplacé :", oldPath, "→", newPath);
            }
        } catch (e) {
            console.error(
                "❌ Erreur déplacement fichier local :",
                e
            );
        }

        doc.category = newCategory;
        doc.path = `/uploads/${newCategory}/${filename}`;
        await doc.save();

        const obj = doc.toObject();

        return res.json({
            ...obj,
            url: obj.path,
            cloudinaryUrl: obj.cloudUrl || null,
        });
    } catch (err) {
        console.error("❌ Erreur PUT /media/:id/move :", err);
        return res
            .status(500)
            .json({ error: "Erreur déplacement média" });
    }
});

/**
 * GET /media/categories
 * Liste toutes les catégories existantes
 */
router.get("/categories", async (req, res) => {
    try {
        const categories = await Media.distinct("category");
        console.log("📂 Catégories trouvées :", categories);
        return res.json(categories);
    } catch (err) {
        console.error("❌ Erreur /categories :", err);
        return res
            .status(500)
            .json({ error: "Erreur lecture catégories" });
    }
});

/**
 * GET /media/categories-with-content
 * Liste les catégories qui ont au moins un média
 */
router.get("/categories-with-content", async (req, res) => {
    try {
        const categories = await Media.distinct("category");
        console.log("📂 Toutes les catégories :", categories);

        const categoriesWithContent = [];
        for (const cat of categories) {
            const count = await Media.countDocuments({
                category: cat,
            });
            if (count > 0) {
                categoriesWithContent.push(cat);
            }
        }

        console.log(
            "✅ Catégories avec contenu :",
            categoriesWithContent
        );
        return res.json(categoriesWithContent);
    } catch (err) {
        console.error(
            "❌ Erreur /categories-with-content :",
            err
        );
        return res
            .status(500)
            .json({ error: "Erreur lecture catégories" });
    }
});

/**
 * GET /media/random
 * Retourne une image aléatoire (hors Flash/actus) pour la Home
 */
router.get("/random", async (req, res) => {
    try {
        console.log("📸 [API] /media/random");

        const baseFilter = {
            category: {
                $nin: [
                    "Flash",
                    "flash",
                    "FLASH",
                    "actus",
                    "Actus",
                    "ACTUS",
                ],
            },
            type: "image",
        };

        const count = await Media.countDocuments(baseFilter);
        console.log("📸 [API] /media/random → count =", count);

        if (!count) {
            return res
                .status(404)
                .json({ error: "Aucune image disponible" });
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

        const preferredPath =
            mediaDoc.path ||
            mediaDoc.url ||
            (mediaDoc.filename
                ? `/uploads/${mediaDoc.category}/${mediaDoc.filename}`
                : "");

        console.log("📸 [API] /media/random → media choisi :", {
            _id: mediaDoc._id,
            category: mediaDoc.category,
            preferredPath,
            cloudUrl: mediaDoc.cloudUrl,
        });

        return res.json({
            ...mediaDoc,
            path: preferredPath,
            url: preferredPath,
            cloudinaryUrl: mediaDoc.cloudUrl || null,
        });
    } catch (err) {
        console.error(
            "❌ [API] /media/random → Erreur serveur :",
            err
        );
        return res.status(500).json({
            error: "Erreur serveur sur /media/random",
        });
    }
});

module.exports = router;
