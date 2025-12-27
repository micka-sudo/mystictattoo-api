import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import sharp from 'sharp';
import Media from '../models/Media';
import verifyToken from '../middlewares/auth';
import cloudinary from '../utils/cloudinary';
import { AuthenticatedRequest, FileRequest } from '../types';

const router = Router();
const uploadsPath = path.join(__dirname, '..', '..', 'uploads');

const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const category = req.body.category || 'uncategorized';
        const dir = path.join(uploadsPath, category);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const baseName = path
            .basename(file.originalname, ext)
            .replace(/\s+/g, '-')
            .replace(/[()]/g, '');
        const name = `${baseName}-${Date.now()}-${Math.floor(Math.random() * 1e9)}${ext}`;
        cb(null, name);
    },
});

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void => {
    const allowedImageTypes = /\.(jpg|jpeg|png|webp|heic|tiff|bmp|avif)$/i;
    const allowedVideoTypes = /\.(mp4|mov|avi|mkv)$/i;
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedImageTypes.test(ext) || allowedVideoTypes.test(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Type de fichier non autorisé'));
    }
};

const upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
    fileFilter
});

const convertToWebP = async (filePath: string): Promise<string> => {
    const outputPath = filePath.replace(path.extname(filePath), '.opt.webp');

    await sharp(filePath)
        .rotate()
        .resize(1920, null, { withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(outputPath);

    return outputPath;
};

const getCloudinaryPublicId = (cloudUrl: string): string | null => {
    if (!cloudUrl) return null;
    try {
        const match = cloudUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
        return match ? match[1] : null;
    } catch {
        console.error("Impossible d'extraire public_id Cloudinary");
        return null;
    }
};

// POST /media/upload
router.post('/upload', verifyToken, upload.single('file'), async (req: FileRequest & AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.file) {
        res.status(400).json({ error: 'Aucun fichier envoyé' });
        return;
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const isImage = /\.(jpg|jpeg|png|webp|heic|tiff|bmp|avif)$/i.test(ext);
    const fullPath = req.file.path;
    const category = req.body.category || 'uncategorized';

    try {
        let finalFilename = req.file.filename;
        let fileUrl = `/uploads/${category}/${finalFilename}`;
        let cloudUrl: string | null = null;
        const type = isImage ? 'image' : 'video';

        if (isImage) {
            const optimizedPath = await convertToWebP(fullPath);
            const optimizedName = path.basename(optimizedPath);

            finalFilename = optimizedName;
            fileUrl = `/uploads/${category}/${optimizedName}`;

            console.log('[UPLOAD IMAGE] envoi à Cloudinary...', { category, optimizedPath });

            try {
                const cloudRes = await cloudinary.uploader.upload(optimizedPath, {
                    folder: `mystic/${category}`,
                    public_id: optimizedName.replace('.webp', ''),
                    resource_type: 'image',
                });

                console.log('Cloudinary upload OK :', cloudRes.secure_url);
                cloudUrl = cloudRes.secure_url;
            } catch (cloudErr) {
                console.error('Cloudinary ERROR:', cloudErr);
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

        res.status(201).json({
            ...obj,
            url: obj.path,
            cloudinaryUrl: obj.cloudUrl || null,
        });
    } catch (err) {
        console.error('Erreur traitement fichier :', err);
        res.status(500).json({ error: 'Erreur upload ou BDD' });
    }
});

// GET /media
// ?raw=true pour désactiver la déduplication (utilisé par le dashboard admin)
router.get('/', async (req: Request, res: Response): Promise<void> => {
    const filter = req.query.style ? { category: req.query.style as string } : {};
    const rawMode = req.query.raw === 'true';

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    // Limite plus haute pour le dashboard (raw mode)
    const maxLimit = rawMode ? 2000 : 100;
    const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    try {
        const total = await Media.countDocuments(filter);

        const media = await Media.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        console.log('Médias trouvés :', media.length, 'sur', total, rawMode ? '(raw mode)' : '');

        let finalMedia = media;

        // Déduplication uniquement si pas en mode raw (pour la galerie publique)
        if (!rawMode) {
            const seen = new Map<string, { doc: typeof media[0]; _score: number }>();

            const scoreExt = (filename = ''): number => {
                const f = filename.toLowerCase();
                if (f.endsWith('.opt.webp')) return 3;
                if (f.endsWith('.webp')) return 2;
                if (/\.(jpg|jpeg|png|heic)$/i.test(f)) return 1;
                if (f.endsWith('.mp4')) return 1;
                return 0;
            };

            for (const m of media) {
                const filename = (m.filename || '').toLowerCase();
                const base = filename.replace(/\.(opt\.webp|webp|jpg|jpeg|png|heic|mp4)$/i, '');
                const currentScore = scoreExt(filename);
                const existing = seen.get(base);

                if (!existing || currentScore > existing._score) {
                    seen.set(base, { doc: m, _score: currentScore });
                }
            }

            finalMedia = Array.from(seen.values()).map(({ doc }) => doc);
        }

        const result = finalMedia.map((m) => {
            const obj = m.toObject();
            return {
                ...obj,
                url: obj.path,
                cloudinaryUrl: obj.cloudUrl || null,
            };
        });

        console.log('Données envoyées :', result.length, 'items');

        if (!req.query.page && !req.query.limit) {
            res.json(result);
            return;
        }

        res.json({
            data: result,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: page * limit < total
            }
        });
    } catch (err) {
        console.error('Erreur /media :', err);
        res.status(500).json({ error: 'Erreur lecture BDD' });
    }
});

// DELETE /media/:id
router.delete('/:id', verifyToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
        const doc = await Media.findById(id);
        if (!doc) {
            res.status(404).json({ error: 'Média introuvable' });
            return;
        }

        if (doc.cloudUrl) {
            const publicId = getCloudinaryPublicId(doc.cloudUrl);
            if (publicId) {
                try {
                    await cloudinary.uploader.destroy(publicId, {
                        resource_type: doc.type === 'video' ? 'video' : 'image',
                    });
                    console.log('Cloudinary asset supprimé :', publicId);
                } catch (e) {
                    console.error('Erreur suppression Cloudinary :', e);
                }
            }
        }

        try {
            const filePath = path.join(uploadsPath, doc.category || '', doc.filename || '');
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log('Fichier local supprimé :', filePath);
            }
        } catch (e) {
            console.error('Erreur suppression fichier local :', e);
        }

        await Media.findByIdAndDelete(id);

        res.json({ success: true });
    } catch (err) {
        console.error('Erreur DELETE /media/:id :', err);
        res.status(500).json({ error: 'Erreur suppression média' });
    }
});

// PUT /media/:id/move
router.put('/:id/move', verifyToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { newCategory } = req.body;

    if (!newCategory) {
        res.status(400).json({ error: 'newCategory requis' });
        return;
    }

    try {
        const doc = await Media.findById(id);
        if (!doc) {
            res.status(404).json({ error: 'Média introuvable' });
            return;
        }

        const oldCategory = doc.category || 'uncategorized';
        const filename = doc.filename || '';

        try {
            const oldPath = path.join(uploadsPath, oldCategory, filename);
            const newDir = path.join(uploadsPath, newCategory);
            const newPath = path.join(newDir, filename);

            if (fs.existsSync(oldPath)) {
                fs.mkdirSync(newDir, { recursive: true });
                fs.renameSync(oldPath, newPath);
                console.log('Fichier déplacé :', oldPath, '->', newPath);
            }
        } catch (e) {
            console.error('Erreur déplacement fichier local :', e);
        }

        doc.category = newCategory;
        doc.path = `/uploads/${newCategory}/${filename}`;
        await doc.save();

        const obj = doc.toObject();

        res.json({
            ...obj,
            url: obj.path,
            cloudinaryUrl: obj.cloudUrl || null,
        });
    } catch (err) {
        console.error('Erreur PUT /media/:id/move :', err);
        res.status(500).json({ error: 'Erreur déplacement média' });
    }
});

// GET /media/categories
router.get('/categories', async (_req: Request, res: Response): Promise<void> => {
    try {
        const categories = await Media.distinct('category');
        console.log('Catégories trouvées :', categories);
        res.json(categories);
    } catch (err) {
        console.error('Erreur /categories :', err);
        res.status(500).json({ error: 'Erreur lecture catégories' });
    }
});

// GET /media/categories-with-content
// Exclut "Accueil" de la liste publique (réservée à l'admin pour la homepage)
router.get('/categories-with-content', async (_req: Request, res: Response): Promise<void> => {
    try {
        const categories = await Media.distinct('category');
        console.log('Toutes les catégories :', categories);

        const categoriesWithContent: string[] = [];
        for (const cat of categories) {
            // Exclure "Accueil" de la galerie publique
            if (cat === 'Accueil') continue;

            const count = await Media.countDocuments({ category: cat });
            if (count > 0) {
                categoriesWithContent.push(cat);
            }
        }

        console.log('Catégories avec contenu (public) :', categoriesWithContent);
        res.json(categoriesWithContent);
    } catch (err) {
        console.error('Erreur /categories-with-content :', err);
        res.status(500).json({ error: 'Erreur lecture catégories' });
    }
});

// GET /media/random - Récupère un média aléatoire de la catégorie "Accueil"
router.get('/random', async (_req: Request, res: Response): Promise<void> => {
    try {
        console.log('[API] /media/random');

        // Filtre uniquement sur la catégorie "Accueil" (images et vidéos)
        const baseFilter = {
            category: 'Accueil',
        };

        const count = await Media.countDocuments(baseFilter);
        console.log('[API] /media/random count (Accueil) =', count);

        if (!count) {
            // Fallback: si aucun média dans Accueil, message informatif
            res.status(404).json({
                error: 'Aucun média dans la catégorie Accueil. Ajoutez des images/vidéos dans cette catégorie depuis l\'admin.'
            });
            return;
        }

        const randomIndex = Math.floor(Math.random() * count);
        const mediaDoc = await Media.findOne(baseFilter).skip(randomIndex).lean();

        if (!mediaDoc) {
            res.status(404).json({ error: 'Média aléatoire introuvable' });
            return;
        }

        const preferredPath =
            mediaDoc.path ||
            (mediaDoc.filename ? `/uploads/${mediaDoc.category}/${mediaDoc.filename}` : '');

        console.log('[API] /media/random media choisi (Accueil) :', {
            _id: mediaDoc._id,
            category: mediaDoc.category,
            type: mediaDoc.type,
            preferredPath,
            cloudUrl: mediaDoc.cloudUrl,
        });

        res.json({
            ...mediaDoc,
            path: preferredPath,
            url: preferredPath,
            cloudinaryUrl: mediaDoc.cloudUrl || null,
        });
    } catch (err) {
        console.error('[API] /media/random Erreur serveur :', err);
        res.status(500).json({ error: 'Erreur serveur sur /media/random' });
    }
});

// POST /media/sync - Synchronise les assets Cloudinary vers MongoDB (protégé)
// ?force=true pour forcer la réimportation complète
router.post('/sync', verifyToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const forceMode = req.query.force === 'true';
        console.log(`[SYNC] Démarrage synchronisation Cloudinary -> MongoDB (force=${forceMode})`);

        const results = {
            added: 0,
            updated: 0,
            skipped: 0,
            errors: 0,
            categories: {} as Record<string, number>,
        };

        // Fonction pour récupérer tous les assets d'un type
        const fetchAssets = async (resourceType: 'image' | 'video') => {
            const assets: any[] = [];
            let nextCursor: string | undefined;

            do {
                const result = await cloudinary.api.resources({
                    type: 'upload',
                    resource_type: resourceType,
                    prefix: 'mystic/',
                    max_results: 500,
                    next_cursor: nextCursor,
                });

                assets.push(...result.resources);
                nextCursor = result.next_cursor;
            } while (nextCursor);

            return assets;
        };

        // Récupérer images et vidéos
        console.log('[SYNC] Récupération des assets Cloudinary...');
        const images = await fetchAssets('image');
        const videos = await fetchAssets('video');

        const allAssets = [
            ...images.map((a: any) => ({ ...a, mediaType: 'image' })),
            ...videos.map((a: any) => ({ ...a, mediaType: 'video' })),
        ];

        console.log(`[SYNC] ${allAssets.length} assets trouvés sur Cloudinary`);

        // Synchroniser chaque asset
        for (const asset of allAssets) {
            try {
                // Extraire catégorie du public_id (format: mystic/Category/filename)
                const parts = asset.public_id.split('/');
                const category = parts.length >= 2 && parts[0] === 'mystic' ? parts[1] : 'uncategorized';
                const baseName = parts[parts.length - 1];
                const filename = `${baseName}.${asset.format}`;
                const cloudUrl = asset.secure_url;

                // Compter par catégorie
                results.categories[category] = (results.categories[category] || 0) + 1;

                // Vérifier si déjà en base par cloudUrl EXACT (sauf en mode force)
                if (!forceMode) {
                    const existingByUrl = await Media.findOne({ cloudUrl });
                    if (existingByUrl) {
                        results.skipped++;
                        continue;
                    }
                }

                // En mode force, supprimer l'existant et recréer
                if (forceMode) {
                    await Media.deleteMany({ cloudUrl });
                }

                // Créer nouveau média
                await Media.create({
                    filename,
                    path: `/uploads/${category}/${filename}`,
                    category,
                    type: asset.mediaType,
                    cloudUrl,
                    tags: [],
                });

                results.added++;
                console.log(`[SYNC] Ajouté: ${category}/${filename}`);

            } catch (err) {
                console.error(`[SYNC] Erreur pour ${asset.public_id}:`, err);
                results.errors++;
            }
        }

        console.log('[SYNC] Synchronisation terminée:', results);

        res.json({
            success: true,
            message: 'Synchronisation terminée',
            results,
        });

    } catch (err) {
        console.error('[SYNC] Erreur:', err);
        res.status(500).json({ error: 'Erreur synchronisation Cloudinary' });
    }
});

// GET /media/cloudinary-status - Liste ce qui est sur Cloudinary (protégé)
router.get('/cloudinary-status', verifyToken, async (_req: Request, res: Response): Promise<void> => {
    try {
        console.log('[CLOUDINARY] Récupération des assets...');

        const fetchAssets = async (resourceType: 'image' | 'video', prefix: string = '') => {
            const assets: any[] = [];
            let nextCursor: string | undefined;

            do {
                const options: any = {
                    type: 'upload',
                    resource_type: resourceType,
                    max_results: 500,
                    next_cursor: nextCursor,
                };
                if (prefix) options.prefix = prefix;

                const result = await cloudinary.api.resources(options);
                assets.push(...result.resources);
                nextCursor = result.next_cursor;
            } while (nextCursor);

            return assets;
        };

        // Récupérer TOUS les assets (avec et sans prefix mystic/)
        const imagesWithPrefix = await fetchAssets('image', 'mystic/');
        const imagesWithoutPrefix = await fetchAssets('image', '');
        const videosWithPrefix = await fetchAssets('video', 'mystic/');

        // Analyser les dossiers
        const folders: Record<string, number> = {};
        const allImages = [...imagesWithPrefix, ...imagesWithoutPrefix];

        for (const img of allImages) {
            const parts = img.public_id.split('/');
            const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '(racine)';
            folders[folder] = (folders[folder] || 0) + 1;
        }

        res.json({
            summary: {
                imagesInMystic: imagesWithPrefix.length,
                totalImages: imagesWithoutPrefix.length,
                videosInMystic: videosWithPrefix.length,
            },
            folders: Object.entries(folders)
                .sort((a, b) => b[1] - a[1])
                .map(([folder, count]) => ({ folder, count })),
            sampleImages: imagesWithoutPrefix.slice(0, 20).map((img: any) => ({
                public_id: img.public_id,
                folder: img.public_id.split('/').slice(0, -1).join('/') || '(racine)',
                url: img.secure_url,
            })),
        });

    } catch (err) {
        console.error('[CLOUDINARY] Erreur:', err);
        res.status(500).json({ error: 'Erreur lecture Cloudinary' });
    }
});

export default router;
