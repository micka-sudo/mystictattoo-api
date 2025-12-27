import fs from 'fs';
import path from 'path';

const uploadsPath = path.join(__dirname, '..', '..', 'uploads');
const publicPath = path.join(__dirname, '..', '..', 'public');
const outputPath = path.join(publicPath, 'sitemap.xml');

const domain = 'https://www.mystic-tattoo.fr';

interface SitemapUrl {
    loc: string;
    priority: string;
    changefreq: string;
}

const staticUrls: SitemapUrl[] = [
    { loc: '/', priority: '1.0', changefreq: 'weekly' },
    { loc: '/gallery', priority: '0.9', changefreq: 'weekly' },
    { loc: '/flash', priority: '0.9', changefreq: 'weekly' },
    { loc: '/contact', priority: '0.7', changefreq: 'yearly' },
    { loc: '/reservation', priority: '0.8', changefreq: 'monthly' }
];

function generateSitemap(): void {
    const urls: SitemapUrl[] = [...staticUrls];

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
        console.error('Erreur lecture uploads/', (err as Error).message);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${domain}${u.loc}</loc>
    <priority>${u.priority}</priority>
    <changefreq>${u.changefreq}</changefreq>
  </url>`).join('\n')}
</urlset>`;

    // Créer le dossier public s'il n'existe pas
    if (!fs.existsSync(publicPath)) {
        fs.mkdirSync(publicPath, { recursive: true });
    }

    fs.writeFileSync(outputPath, xml, 'utf8');
    console.log(`Sitemap généré : ${outputPath}`);
}

// Appel direct si lancé depuis CLI
if (require.main === module) {
    generateSitemap();
}

export default generateSitemap;
