// scripts/generateSitemap.js
const fs = require('fs');
const path = require('path');

const uploadsPath = path.join(__dirname, '..', 'uploads');
const publicPath = path.join(__dirname, '..', 'public');
const outputPath = path.join(publicPath, 'sitemap.xml');

const domain = 'https://www.mystic-tattoo.fr';

const staticUrls = [
    { loc: '/', priority: '1.0', changefreq: 'weekly' },
    { loc: '/gallery', priority: '0.9', changefreq: 'weekly' },
    { loc: '/flash', priority: '0.9', changefreq: 'weekly' },
    { loc: '/contact', priority: '0.7', changefreq: 'yearly' },
    { loc: '/reservation', priority: '0.8', changefreq: 'monthly' }
];

function generateSitemap() {
    let urls = [...staticUrls];

    try {
        const categories = fs.readdirSync(uploadsPath).filter(dir => {
            const fullPath = path.join(uploadsPath, dir);
            return fs.statSync(fullPath).isDirectory() && dir.toLowerCase() !== 'flash';
        });

        categories.forEach(style => {
            urls.push({
                loc: `/gallery/${style}`,
                priority: '0.8',
                changefreq: 'monthly'
            });
        });
    } catch (err) {
        console.error('❌ Erreur lecture uploads/', err.message);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${domain}${u.loc}</loc>
    <priority>${u.priority}</priority>
    <changefreq>${u.changefreq}</changefreq>
  </url>`).join('\n')}
</urlset>`;

    fs.writeFileSync(outputPath, xml, 'utf8');
    console.log(`✅ Sitemap généré : ${outputPath}`);
}

// 👉 Appel direct si lancé depuis CLI
if (require.main === module) {
    generateSitemap();
}

module.exports = generateSitemap;
