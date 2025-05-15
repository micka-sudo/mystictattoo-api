// scripts/generate-sitemap.js
const fs = require('fs');
const axios = require('axios');
const path = require('path');

const BASE_URL = 'https://www.mystic-tattoo.fr';
const API_URL = 'http://localhost:4000/api/media/styles'; // adapte à ton backend

async function generateSitemap() {
    try {
        const staticUrls = [
            '/',
            '/galerie',
            '/booking',
        ];

        const { data: styles } = await axios.get(API_URL);
        const styleUrls = styles.map(style => `/galerie?style=${style}`);

        const allUrls = [...staticUrls, ...styleUrls];

        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(url => `
  <url>
    <loc>${BASE_URL}${url}</loc>
    <priority>${url === '/' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>`;

        const outputPath = path.join(__dirname, '../public/sitemap.xml');
        fs.writeFileSync(outputPath, sitemap.trim());

        console.log('✅ sitemap.xml généré avec succès à :', outputPath);
    } catch (err) {
        console.error('❌ Erreur lors de la génération du sitemap :', err.message);
    }
}

generateSitemap();
