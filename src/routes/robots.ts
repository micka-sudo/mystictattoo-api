import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import generateSitemap from '../scripts/generateSitemap';

const router = Router();

// GET /robots.txt
router.get('/robots.txt', (_req: Request, res: Response): void => {
    res.type('text/plain');

    try {
        generateSitemap();
    } catch (err) {
        console.warn('Impossible de régénérer le sitemap automatiquement', (err as Error).message);
    }

    const sitemapPath = path.join(__dirname, '..', '..', 'public', 'sitemap.xml');
    const sitemapLine = fs.existsSync(sitemapPath)
        ? 'Sitemap: https://www.mystic-tattoo.fr/sitemap.xml'
        : '# Sitemap not found';

    res.send(`User-agent: *
Disallow:

${sitemapLine}
Host: https://www.mystic-tattoo.fr`);
});

export default router;
