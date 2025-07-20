const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const generateSitemap = require('../scripts/generateSitemap');

router.get('/robots.txt', (req, res) => {
    res.type('text/plain');

    try {
        // 🔁 Génére le fichier sitemap.xml à chaque appel
        generateSitemap();
    } catch (err) {
        console.warn('⚠️ Impossible de régénérer le sitemap automatiquement', err.message);
    }

    const sitemapPath = path.join(__dirname, '..', 'public', 'sitemap.xml');
    const sitemapLine = fs.existsSync(sitemapPath)
        ? `Sitemap: https://www.mystic-tattoo.fr/sitemap.xml`
        : `# Sitemap not found`;

    res.send(`User-agent: *
Disallow:

${sitemapLine}
Host: https://www.mystic-tattoo.fr`);
});

module.exports = router;
