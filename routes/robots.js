const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

router.get('/robots.txt', (req, res) => {
    res.type('text/plain');

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
