import { Router, Request, Response } from 'express';
import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import multer from 'multer';
import sharp from 'sharp';
import verifyToken from '../middlewares/auth';
import News from '../models/News';
import { AuthenticatedRequest, FileRequest } from '../types';

const router = Router();
const uploadsBasePath = path.join(__dirname, '..', '..', 'uploads');
const newsUploadsPath = path.join(uploadsBasePath, 'news');

fsSync.mkdirSync(newsUploadsPath, { recursive: true });

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, newsUploadsPath);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const baseName = path.basename(file.originalname, ext)
            .replace(/\s+/g, '-')
            .replace(/[^a-zA-Z0-9-]/g, '');
        const name = `${baseName}-${Date.now()}-${Math.floor(Math.random() * 1e9)}.jpg`;
        cb(null, name);
    },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void => {
    const allowedTypes = /\.(jpg|jpeg|png|webp|gif)$/i;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.test(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Type de fichier non autorisé (jpg, png, webp, gif uniquement)'));
    }
};

const upload = multer({
    storage,
    limits: { fileSize: MAX_IMAGE_SIZE },
    fileFilter
});

const convertToOptimizedJpeg = async (filePath: string): Promise<void> => {
    const tempPath = filePath + '.tmp.jpg';
    try {
        await sharp(filePath)
            .rotate()
            .resize(1920, null, { withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toFile(tempPath);

        await fs.unlink(filePath);
        await fs.rename(tempPath, filePath);
    } catch (err) {
        try {
            await fs.unlink(tempPath);
        } catch {
            // Ignorer
        }
        console.error('Erreur conversion JPEG actus:', (err as Error).message);
        throw err;
    }
};

// GET /news
router.get('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const filter: { isVisible?: boolean } = {};
        if (req.query.visible === 'true') {
            filter.isVisible = true;
        }

        const news = await News.find(filter).sort({ createdAt: -1 });

        const result = news.map(n => ({
            id: n._id,
            _id: n._id,
            title: n.title,
            content: n.content,
            image: n.image || '',
            isVisible: n.isVisible,
            createdAt: n.createdAt
        }));

        res.json(result);
    } catch (err) {
        console.error('Erreur GET /news:', err);
        res.status(500).json({ error: 'Erreur lecture des actualités' });
    }
});

// POST /news
router.post('/', verifyToken, upload.single('image'), async (req: FileRequest & AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { title, content } = req.body;
        const isVisible = req.body.isVisible === undefined ||
            req.body.isVisible === 'true' ||
            req.body.isVisible === true;

        if (!title || !content) {
            res.status(400).json({ error: 'Champs requis: title et content' });
            return;
        }

        if (title.length > 200) {
            res.status(400).json({ error: 'Le titre ne doit pas dépasser 200 caractères' });
            return;
        }

        let imagePath = '';

        if (req.file) {
            try {
                await convertToOptimizedJpeg(req.file.path);
                imagePath = `/uploads/news/${req.file.filename}`;
            } catch (err) {
                console.error('Erreur traitement image:', err);
            }
        } else if (req.body.image) {
            imagePath = req.body.image;
        }

        const newNews = await News.create({
            title: title.trim(),
            content: content.trim(),
            image: imagePath,
            isVisible
        });

        res.status(201).json({
            id: newNews._id,
            _id: newNews._id,
            title: newNews.title,
            content: newNews.content,
            image: newNews.image,
            isVisible: newNews.isVisible,
            createdAt: newNews.createdAt
        });
    } catch (err) {
        console.error('Erreur POST /news:', err);
        res.status(500).json({ error: 'Erreur création actualité' });
    }
});

// PUT /news/:id
router.put('/:id', verifyToken, upload.single('image'), async (req: FileRequest & AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { title, content, isVisible } = req.body;

        const news = await News.findById(id);
        if (!news) {
            res.status(404).json({ error: 'Actualité non trouvée' });
            return;
        }

        if (title !== undefined) {
            if (title.length > 200) {
                res.status(400).json({ error: 'Le titre ne doit pas dépasser 200 caractères' });
                return;
            }
            news.title = title.trim();
        }

        if (content !== undefined) {
            news.content = content.trim();
        }

        if (isVisible !== undefined) {
            news.isVisible = isVisible === 'true' || isVisible === true;
        }

        if (req.file) {
            try {
                if (news.image && news.image.startsWith('/uploads/news/')) {
                    const oldImagePath = path.join(uploadsBasePath, 'news', path.basename(news.image));
                    try {
                        await fs.unlink(oldImagePath);
                    } catch {
                        // Ignorer
                    }
                }

                await convertToOptimizedJpeg(req.file.path);
                news.image = `/uploads/news/${req.file.filename}`;
            } catch (err) {
                console.error('Erreur traitement image:', err);
            }
        } else if (req.body.image !== undefined) {
            news.image = req.body.image;
        }

        await news.save();

        res.json({
            id: news._id,
            _id: news._id,
            title: news.title,
            content: news.content,
            image: news.image,
            isVisible: news.isVisible,
            createdAt: news.createdAt,
            updatedAt: news.updatedAt
        });
    } catch (err) {
        console.error('Erreur PUT /news:', err);
        res.status(500).json({ error: 'Erreur mise à jour actualité' });
    }
});

// DELETE /news/:id
router.delete('/:id', verifyToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const news = await News.findById(id);
        if (!news) {
            res.status(404).json({ error: 'Actualité non trouvée' });
            return;
        }

        if (news.image && news.image.startsWith('/uploads/news/')) {
            const imagePath = path.join(uploadsBasePath, 'news', path.basename(news.image));
            try {
                await fs.unlink(imagePath);
                console.log('Image supprimée:', imagePath);
            } catch {
                // Ignorer
            }
        }

        await News.findByIdAndDelete(id);

        res.json({
            id: news._id,
            _id: news._id,
            title: news.title,
            content: news.content,
            image: news.image,
            isVisible: news.isVisible,
            createdAt: news.createdAt
        });
    } catch (err) {
        console.error('Erreur DELETE /news:', err);
        res.status(500).json({ error: 'Erreur suppression actualité' });
    }
});

export default router;
