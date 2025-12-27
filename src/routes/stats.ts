import { Router, Request, Response } from 'express';
import Visit from '../models/Visit';
import verifyToken from '../middlewares/auth';

const router = Router();

// Fonction pour détecter le type d'appareil
function detectDevice(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
    const ua = userAgent.toLowerCase();
    if (/mobile|android.*mobile|iphone|ipod|blackberry|windows phone/i.test(ua)) {
        return 'mobile';
    }
    if (/tablet|ipad|android(?!.*mobile)/i.test(ua)) {
        return 'tablet';
    }
    return 'desktop';
}

// Fonction pour détecter le navigateur
function detectBrowser(userAgent: string): string {
    const ua = userAgent.toLowerCase();
    if (ua.includes('firefox')) return 'Firefox';
    if (ua.includes('edg')) return 'Edge';
    if (ua.includes('chrome')) return 'Chrome';
    if (ua.includes('safari')) return 'Safari';
    if (ua.includes('opera') || ua.includes('opr')) return 'Opera';
    return 'Autre';
}

// POST /api/stats/visit - Enregistrer une visite (appelé depuis le frontend)
router.post('/visit', async (req: Request, res: Response) => {
    try {
        const { page, sessionId } = req.body;
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
            || req.socket?.remoteAddress
            || 'unknown';
        const userAgent = req.headers['user-agent'] || '';
        const referer = req.headers['referer'] || '';

        const visit = new Visit({
            page: page || '/',
            ip,
            userAgent,
            referer,
            device: detectDevice(userAgent),
            browser: detectBrowser(userAgent),
            sessionId: sessionId || '',
        });

        await visit.save();
        res.status(201).json({ success: true });
    } catch (err) {
        console.error('Erreur enregistrement visite:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// GET /api/stats - Récupérer les statistiques (protégé)
router.get('/', verifyToken, async (req: Request, res: Response) => {
    try {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Valeurs par défaut si collection vide
        let totalVisits = 0;
        let todayVisits = 0;
        let weekVisits = 0;
        let monthVisits = 0;
        let uniqueVisitors: string[] = [];
        let topPages: Array<{ _id: string; count: number }> = [];
        let deviceStats: Array<{ _id: string; count: number }> = [];
        let browserStats: Array<{ _id: string; count: number }> = [];
        let dailyVisits: Array<{ _id: string; count: number }> = [];
        let refererStats: Array<{ _id: string; count: number }> = [];

        try {
            // Visites totales
            totalVisits = await Visit.countDocuments();

            // Visites aujourd'hui
            todayVisits = await Visit.countDocuments({
                createdAt: { $gte: today }
            });

            // Visites cette semaine
            weekVisits = await Visit.countDocuments({
                createdAt: { $gte: weekAgo }
            });

            // Visites ce mois
            monthVisits = await Visit.countDocuments({
                createdAt: { $gte: monthAgo }
            });

            // Visiteurs uniques (par IP) ce mois
            uniqueVisitors = await Visit.distinct('ip', {
                createdAt: { $gte: monthAgo }
            });
        } catch (countErr) {
            console.error('Erreur comptage visites:', countErr);
        }

        try {
            // Pages les plus visitées (top 10)
            topPages = await Visit.aggregate([
                { $match: { createdAt: { $gte: monthAgo } } },
                { $group: { _id: '$page', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]);
        } catch (aggErr) {
            console.error('Erreur agrégation topPages:', aggErr);
        }

        try {
            // Répartition par appareil
            deviceStats = await Visit.aggregate([
                { $match: { createdAt: { $gte: monthAgo } } },
                { $group: { _id: '$device', count: { $sum: 1 } } }
            ]);
        } catch (aggErr) {
            console.error('Erreur agrégation deviceStats:', aggErr);
        }

        try {
            // Répartition par navigateur
            browserStats = await Visit.aggregate([
                { $match: { createdAt: { $gte: monthAgo } } },
                { $group: { _id: '$browser', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]);
        } catch (aggErr) {
            console.error('Erreur agrégation browserStats:', aggErr);
        }

        try {
            // Visites par jour (30 derniers jours)
            dailyVisits = await Visit.aggregate([
                { $match: { createdAt: { $gte: monthAgo } } },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]);
        } catch (aggErr) {
            console.error('Erreur agrégation dailyVisits:', aggErr);
        }

        try {
            // Sources de trafic (referers)
            refererStats = await Visit.aggregate([
                { $match: { createdAt: { $gte: monthAgo }, referer: { $ne: '' } } },
                { $group: { _id: '$referer', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 10 }
            ]);
        } catch (aggErr) {
            console.error('Erreur agrégation refererStats:', aggErr);
        }

        res.json({
            summary: {
                total: totalVisits,
                today: todayVisits,
                week: weekVisits,
                month: monthVisits,
                uniqueVisitors: uniqueVisitors.length,
            },
            topPages,
            deviceStats,
            browserStats,
            dailyVisits,
            refererStats,
        });
    } catch (err) {
        console.error('Erreur récupération stats:', err);
        // Retourner des données vides plutôt qu'une erreur 500
        res.json({
            summary: {
                total: 0,
                today: 0,
                week: 0,
                month: 0,
                uniqueVisitors: 0,
            },
            topPages: [],
            deviceStats: [],
            browserStats: [],
            dailyVisits: [],
            refererStats: [],
        });
    }
});

export default router;
