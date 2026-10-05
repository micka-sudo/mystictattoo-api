import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import 'dotenv/config';

import logger from './services/logger';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger';

import routes from './routes';
import sitemapRoute from './routes/sitemap';
import robotsRoute from './routes/robots';
import { AdminConfig } from './types';

const adminConfigPath = path.join(__dirname, '..', 'config', 'admin.json');
const uploadsPath = path.join(__dirname, '..', 'uploads');
const frontendPath = path.join(__dirname, '..', 'client', 'build');

const app = express();
const PORT = process.env.PORT || 4000;
const isProduction = process.env.NODE_ENV === 'production';

// Render place l'API derrière un proxy : req.ip doit être l'IP du visiteur
// (sinon le rate limiting compte tous les visiteurs ensemble).
// TRUST_PROXY = nombre de proxys entre le visiteur et l'API (1 par défaut).
const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY || '1', 10);
app.set('trust proxy', Number.isNaN(trustProxyHops) ? 1 : trustProxyHops);

// Diagnostic unique : nombre d'adresses dans X-Forwarded-For (sans les adresses elles-mêmes).
// Avec un seul proxy (Render), on attend 1 adresse ; davantage = ajuster TRUST_PROXY.
let proxyDiagnosticDone = false;
app.use((req: Request, _res: Response, next: NextFunction) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (!proxyDiagnosticDone && typeof forwarded === 'string') {
        proxyDiagnosticDone = true;
        logger.info('Diagnostic proxy', {
            adressesXForwardedFor: forwarded.split(',').length,
            trustProxy: app.get('trust proxy'),
        });
    }
    next();
});

// Parseur de query simple : ?style[$ne]=x n'est pas transformé en objet (injection d'opérateurs MongoDB)
app.set('query parser', 'simple');

// Sentry
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: 0.1,
        integrations: [
            Sentry.mongooseIntegration()
        ]
    });
    logger.info('Sentry initialisé');
}

// Helmet
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false
}));

// CORS (avant les limiteurs : les réponses 429 gardent leurs en-têtes CORS)
const defaultOrigins = [
    'http://localhost:3000',
    'https://mystictattoo-chat.vercel.app',
    'https://www.mystic-tattoo.fr'
];
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : defaultOrigins;

app.use(cors({ origin: allowedOrigins, credentials: true }));

// Rate Limiting global
const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Trop de requêtes, veuillez réessayer dans une minute' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api', globalLimiter);

// Rate Limiting login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Trop de tentatives de connexion, réessayez dans 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
    // Seuls les échecs comptent : un rafraîchissement de session réussi ne bloque pas l'admin
    skipSuccessfulRequests: true
});
app.use('/api/login', loginLimiter);

// Formulaires publics : nombre d'enregistrements limité par visiteur
const visitLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Trop de requêtes' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/stats/visit', visitLimiter);

const reservationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: 'Trop de demandes de réservation, réessayez dans une heure' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.method !== 'POST'
});
app.use('/api/reservations', reservationLimiter);

// Logging middleware
app.use(logger.middleware());

// Body parsing (les fichiers passent par multer, pas par ces parseurs)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// MongoDB
mongoose.connect(process.env.MONGO_URI as string)
    .then(() => logger.info('Connexion MongoDB établie'))
    .catch(err => logger.error('Connexion MongoDB échouée', { error: err.message }));

// Static uploads
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Swagger (hors production uniquement)
if (!isProduction) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Mystic Tattoo API'
    }));
}

// API Routes
app.use('/api', routes);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
    const mongoState = mongoose.connection.readyState;
    const mongoStatus = mongoState === 1 ? 'connected' : mongoState === 2 ? 'connecting' : 'disconnected';

    res.json({
        status: mongoState === 1 ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        mongodb: mongoStatus
    });
});

// Legacy ping route
app.get('/ping', (_req: Request, res: Response) => {
    res.send('Backend Mystic Tattoo opérationnel');
});

// SEO Routes
app.use('/', sitemapRoute);
app.use('/', robotsRoute);

// Frontend
if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
} else {
    logger.warn('Frontend non trouvé dans /client/build');
}

// Error handler
interface HttpError extends Error {
    status?: number;
}

app.use((err: HttpError, req: Request, res: Response, _next: NextFunction) => {
    if (process.env.SENTRY_DSN) {
        Sentry.captureException(err);
    }
    logger.apiError(req, err);
    const status = err.status || 500;
    // Le détail des erreurs internes reste dans les logs, pas dans la réponse
    res.status(status).json({ error: status < 500 && err.message ? err.message : 'Erreur serveur interne' });
});

// Start server
app.listen(PORT, () => {
    let showNews = 'non chargé';
    try {
        const config: AdminConfig = JSON.parse(fs.readFileSync(adminConfigPath, 'utf8'));
        showNews = config.showNewsOnHome ? 'affichées' : 'masquées';
    } catch {
        logger.warn('admin.json introuvable ou invalide');
    }

    logger.info(`Serveur démarré sur le port ${PORT}`, {
        port: PORT,
        env: process.env.NODE_ENV || 'development',
        newsOnHome: showNews
    });
});

// Error handlers
process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled Rejection', { reason: (reason as Error)?.message || reason });
});

process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
    process.exit(1);
});

export default app;
