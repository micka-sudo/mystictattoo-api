import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import generateSitemap from '../scripts/generateSitemap';

const router = Router();

// Le sitemap est régénéré au plus une fois par heure, pas à chaque requête
const SITEMAP_REFRESH_MS = 60 * 60 * 1000;
let lastSitemapGeneration = 0;

// GET /robots.txt
router.get('/robots.txt', (_req: Request, res: Response): void => {
    res.type('text/plain');

    if (Date.now() - lastSitemapGeneration > SITEMAP_REFRESH_MS) {
        lastSitemapGeneration = Date.now();
        try {
            generateSitemap();
        } catch (err) {
            console.warn('Impossible de régénérer le sitemap automatiquement', (err as Error).message);
        }
    }

    const sitemapPath = path.join(__dirname, '..', '..', 'public', 'sitemap.xml');
    const sitemapLine = fs.existsSync(sitemapPath)
        ? 'Sitemap: https://www.mystic-tattoo.fr/sitemap.xml'
        : '# Sitemap not found';

    res.send(`User-agent: *
Disallow: /api/
Disallow: /admin

${sitemapLine}
Host: https://www.mystic-tattoo.fr`);
});

export default router;
