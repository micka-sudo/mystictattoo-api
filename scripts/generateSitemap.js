const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.mystic-tattoo.fr';

const staticRoutes = [
    '/',
    '/gallery',
    '/flash',
    '/contact',
    '/mentions-legales'
];

function generateSitemap() {
    const urls = staticRoutes.map(route => {
        return `<url><loc>${BASE_URL}${route}</loc></url>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls}
  </urlset>`;
}

function saveSitemap() {
    const sitemap = generateSitemap();
    const sitemapPath = path.join(__dirname, '../public/sitemap.xml');
    fs.writeFileSync(sitemapPath, sitemap, 'utf8');
    console.log('✅ sitemap.xml généré');
}

if (require.main === module) {
    saveSitemap();
}

module.exports = generateSitemap;
