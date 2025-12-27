import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

const publicPath = path.join(__dirname, '..', '..', 'public');

// GET /sitemap.xml
router.get('/sitemap.xml', (_req: Request, res: Response): void => {
    const sitemapPath = path.join(publicPath, 'sitemap.xml');

    if (fs.existsSync(sitemapPath)) {
        res.type('application/xml');
        res.sendFile(sitemapPath);
    } else {
        res.status(404).send('Sitemap not found');
    }
});

export default router;
