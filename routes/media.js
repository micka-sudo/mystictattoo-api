const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const convert = require('heic-convert');
const verifyToken = require('../middlewares/auth');

const router = express.Router();
const uploadsPath = path.join(__dirname, '..', 'uploads');

// Fonction récursive pour explorer les fichiers
const walkDir = (dir, baseCategory = '') => {
    const media = [];

    try {
        if (!fs.existsSync(dir)) return [];

        fs.readdirSync(dir).forEach((file) => {
            const fullPath = path.join(dir, file);
            const relativePath = fullPath.replace(uploadsPath, '').replace(/\\/g, '/');

            if (fs.statSync(fullPath).isDirectory()) {
                media.push(...walkDir(fullPath, path.basename(fullPath)));
            } else {
                media.push({
                    file,
                    url: '/uploads' + relativePath,
                    type: /\.(mp4|mov|avi)$/i.test(file) ? 'video' : 'image',
                    category: baseCategory || 'all',
                    tags: []
                });
            }
        });

        return media;
    } catch (err) {
        console.error(`Erreur lecture dossier ${dir}`, err);
        return [];
    }
};

// 🔧 Multer pour upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const category = req.body.category || 'uncategorized';
        const targetDir = path.join(uploadsPath, category);
        fs.mkdirSync(targetDir, { recursive: true });
        cb(null, targetDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const baseName = path.basename(file.originalname, ext).replace(/\s+/g, '-');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${baseName}-${uniqueSuffix}${ext}`);
    }
});
const upload = multer({ storage });

// 🔁 Conversion automatique si HEIC, etc.
const convertToJpeg = async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const convertible = ['.heic', '.webp', '.png', '.tiff', '.bmp', '.avif'];
    if (!convertible.includes(ext)) return;

    const outputPath = filePath.replace(ext, '.jpg');

    try {
        console.log(`🔧 Conversion avec sharp : ${path.basename(filePath)}`);
        await sharp(filePath).rotate().jpeg({ quality: 90 }).toFile(outputPath);
        fs.unlinkSync(filePath);
        console.log(`✅ Converti avec sharp → ${outputPath}`);
    } catch (errSharp) {
        if (ext === '.heic') {
            try {
                const inputBuffer = fs.readFileSync(filePath);
                const outputBuffer = await convert({
                    buffer: inputBuffer,
                    format: 'JPEG',
                    quality: 1,
                });
                fs.writeFileSync(outputPath, outputBuffer);
                fs.unlinkSync(filePath);
                console.log(`✅ Converti avec heic-convert → ${outputPath}`);
            } catch (errHeic) {
                console.error(`❌ heic-convert a échoué pour ${filePath}`, errHeic.message);
            }
        } else {
            console.error(`❌ sharp a échoué pour ${filePath}`, errSharp.message);
        }
    }
};

// 🔓 GET /media
router.get('/', (req, res) => {
    const style = req.query.style;
    const targetPath = style ? path.join(uploadsPath, style) : uploadsPath;

    try {
        const media = walkDir(targetPath, style);
        res.json(media);
    } catch (err) {
        console.error('Erreur lecture médias', err);
        res.status(500).json({ error: 'Erreur lecture médias' });
    }
});

// 🔓 GET /media/categories
router.get('/categories', (req, res) => {
    try {
        const categories = fs.readdirSync(uploadsPath).filter(name => {
            const fullPath = path.join(uploadsPath, name);
            return fs.statSync(fullPath).isDirectory();
        });
        res.json(categories);
    } catch (err) {
        console.error('Erreur lecture catégories', err);
        res.status(500).json({ error: 'Impossible de lire les catégories' });
    }
});

// ✅ NOUVELLE ROUTE : /media/categories-with-content
router.get('/categories-with-content', (req, res) => {
    try {
        const categories = fs.readdirSync(uploadsPath).filter((category) => {
            const categoryPath = path.join(uploadsPath, category);

            if (!fs.statSync(categoryPath).isDirectory()) return false;

            const files = fs.readdirSync(categoryPath).filter(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.avi'].includes(ext);
            });

            return files.length > 0;
        });

        res.json(categories);
    } catch (err) {
        console.error('Erreur lecture catégories avec contenu', err);
        res.status(500).json({ error: 'Erreur lecture catégories' });
    }
});

// 🔐 POST /media/category
router.post('/category', verifyToken, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom de catégorie requis' });

    const safeName = name.trim().toLowerCase().replace(/[^a-z0-9_-]/gi, '');
    const categoryPath = path.join(uploadsPath, safeName);

    try {
        if (fs.existsSync(categoryPath)) {
            return res.status(409).json({ error: 'Catégorie déjà existante' });
        }

        fs.mkdirSync(categoryPath, { recursive: true });
        return res.status(201).json({ message: 'Catégorie créée', category: safeName });
    } catch (err) {
        console.error('Erreur création catégorie', err);
        return res.status(500).json({ error: 'Erreur création catégorie' });
    }
});

// 🔐 DELETE /media/category
router.delete('/category', verifyToken, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom de catégorie requis' });

    const categoryPath = path.join(uploadsPath, name);

    try {
        if (!fs.existsSync(categoryPath)) {
            return res.status(404).json({ error: 'Catégorie inexistante' });
        }

        const files = fs.readdirSync(categoryPath);
        if (files.length > 0) {
            return res.status(400).json({ error: 'Catégorie non vide' });
        }

        fs.rmdirSync(categoryPath);
        return res.json({ message: 'Catégorie supprimée' });
    } catch (err) {
        console.error('Erreur suppression catégorie', err);
        return res.status(500).json({ error: 'Erreur suppression catégorie' });
    }
});

// 🔓 GET /media/random-image
router.get('/random-image', (req, res) => {
    const style = req.query.style;
    const targetPath = style ? path.join(uploadsPath, style) : uploadsPath;
    const images = [];

    const walk = (dir) => {
        fs.readdirSync(dir).forEach(file => {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                walk(fullPath);
            } else if (/\.(jpe?g|png|webp|gif|JPG)$/i.test(file)) {
                const relativePath = fullPath.replace(uploadsPath, '').replace(/\\/g, '/');
                images.push(`/uploads${relativePath}`);
            }
        });
    };

    try {
        walk(targetPath);
        if (images.length === 0) return res.status(404).json({ error: 'Aucune image trouvée' });

        const randomImage = images[Math.floor(Math.random() * images.length)];
        res.json({ url: randomImage });
    } catch (err) {
        console.error('Erreur image aléatoire', err);
        res.status(500).json({ error: 'Erreur lecture aléatoire' });
    }
});

// 🔐 DELETE /media
router.delete('/', verifyToken, (req, res) => {
    const { file, category } = req.body;
    if (!file || !category) return res.status(400).json({ error: 'Fichier ou catégorie manquant' });

    const filePath = path.join(uploadsPath, category, file);

    try {
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Fichier introuvable' });
        }

        fs.unlinkSync(filePath);
        res.json({ message: 'Fichier supprimé avec succès' });
    } catch (err) {
        console.error('Erreur suppression fichier', err);
        res.status(500).json({ error: 'Erreur suppression' });
    }
});

// 🔐 POST /media/upload
router.post('/upload', verifyToken, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
    }

    try {
        await convertToJpeg(req.file.path);
        res.status(200).json({ message: 'Fichier uploadé (et converti si nécessaire)' });
    } catch (err) {
        console.error('❌ Erreur upload ou conversion', err);
        res.status(500).json({ error: 'Erreur upload/conversion' });
    }
});

// ✅ NOUVELLE ROUTE POUR SITEMAP : /media/styles
router.get('/styles', (req, res) => {
    try {
        const styles = fs.readdirSync(uploadsPath).filter((dir) => {
            const fullPath = path.join(uploadsPath, dir);
            if (!fs.statSync(fullPath).isDirectory()) return false;

            const hasMedia = fs.readdirSync(fullPath).some(file => {
                const ext = path.extname(file).toLowerCase();
                return ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.avi'].includes(ext);
            });

            return hasMedia;
        });

        res.json(styles);
    } catch (err) {
        console.error('Erreur lors de la lecture des styles', err);
        res.status(500).json({ error: 'Erreur lecture des styles' });
    }
});

module.exports = router;
