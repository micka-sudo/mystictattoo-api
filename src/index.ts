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

// Rate Limiting global
const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Trop de requêtes, veuillez réessayer dans une minute' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use(globalLimiter);

// Rate Limiting login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Trop de tentatives de connexion, réessayez dans 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/login', loginLimiter);

// CORS
const defaultOrigins = [
    'http://localhost:3000',
    'https://mystictattoo-chat.vercel.app',
    'https://www.mystic-tattoo.fr'
];
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : defaultOrigins;

app.use(cors({ origin: allowedOrigins, credentials: true }));

// Logging middleware
app.use(logger.middleware());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB
mongoose.connect(process.env.MONGO_URI as string)
    .then(() => logger.info('Connexion MongoDB établie'))
    .catch(err => logger.error('Connexion MongoDB échouée', { error: err.message }));

// Static uploads
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Swagger
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Mystic Tattoo API'
}));

// API Routes
app.use('/api', routes);

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

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
    const mongoState = mongoose.connection.readyState;
    const mongoStatus = mongoState === 1 ? 'connected' : mongoState === 2 ? 'connecting' : 'disconnected';

    res.json({
        status: mongoState === 1 ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        mongodb: mongoStatus,
        version: process.env.npm_package_version || '1.2.1',
        env: process.env.NODE_ENV || 'development'
    });
});

// Legacy ping route
app.get('/ping', (_req: Request, res: Response) => {
    res.send('Backend Mystic Tattoo opérationnel');
});

// Error handler
interface HttpError extends Error {
    status?: number;
}

app.use((err: HttpError, req: Request, res: Response, _next: NextFunction) => {
    if (process.env.SENTRY_DSN) {
        Sentry.captureException(err);
    }
    logger.apiError(req, err);
    res.status(err.status || 500).json({ error: err.message || 'Erreur serveur interne' });
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
