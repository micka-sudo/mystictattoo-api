// routes/sitemap.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const uploadsPath = path.join(__dirname, '..', 'uploads');

router.get('/sitemap.xml', (req, res) => {
    const domain = 'https://www.mystic-tattoo.fr';

    let urls = [
        { loc: '/', priority: '1.0', changefreq: 'weekly' },
        { loc: '/gallery', priority: '0.9', changefreq: 'weekly' },
        { loc: '/flash', priority: '0.9', changefreq: 'weekly' },
        { loc: '/contact', priority: '0.7', changefreq: 'yearly' },
        { loc: '/reservation', priority: '0.8', changefreq: 'monthly' }
    ];

    // Ajout des styles dynamiques depuis les dossiers
    try {
        const categories = fs.readdirSync(uploadsPath)
            .filter(dir => {
                const fullPath = path.join(uploadsPath, dir);
                return fs.statSync(fullPath).isDirectory()
                    && dir.toLowerCase() !== 'flash';
            });

        categories.forEach((style) => {
            urls.push({
                loc: `/gallery/${style}`,
                priority: '0.8',
                changefreq: 'monthly'
            });
        });
    } catch (err) {
        console.error("Erreur lecture uploads/", err.message);
    }

    // Génération XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `
  <url>
    <loc>${domain}${u.loc}</loc>
    <priority>${u.priority}</priority>
    <changefreq>${u.changefreq}</changefreq>
  </url>`).join('')}
</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
});

module.exports = router;
