import winston from 'winston';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { LogMeta, RequestLogMeta } from '../types';

// Format personnalisé pour les logs
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}] ${message}`;

        if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta)}`;
        }

        if (stack) {
            log += `\n${stack}`;
        }

        return log;
    })
);

// Format JSON pour la production
const jsonFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

const logsDir = path.join(__dirname, '..', '..', 'logs');

// Configuration des transports
const transports: winston.transport[] = [
    new winston.transports.Console({
        format: isProduction
            ? jsonFormat
            : winston.format.combine(winston.format.colorize(), customFormat),
    }),
];

// En production, ajouter les fichiers de log
if (isProduction) {
    transports.push(
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            format: jsonFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            format: jsonFormat,
            maxsize: 5242880,
            maxFiles: 5,
        })
    );
}

// Créer le logger de base
const baseLogger = winston.createLogger({
    level: logLevel,
    transports,
    exitOnError: false,
});

// Interface pour le logger étendu
interface ExtendedLogger extends winston.Logger {
    request: (req: Request, message: string, meta?: LogMeta) => void;
    apiError: (req: Request, error: Error, meta?: LogMeta) => void;
    middleware: () => (req: Request, res: Response, next: NextFunction) => void;
}

// Étendre le logger avec des helpers
const logger = baseLogger as ExtendedLogger;

// Helper pour logger les requêtes avec contexte
logger.request = (req: Request, message: string, meta: LogMeta = {}): void => {
    const requestMeta: RequestLogMeta = {
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        ...meta,
    };
    logger.info(message, requestMeta);
};

// Helper pour logger les erreurs API
logger.apiError = (req: Request, error: Error, meta: LogMeta = {}): void => {
    logger.error(error.message, {
        method: req.method,
        path: req.path,
        ip: req.ip,
        stack: error.stack,
        ...meta,
    });
};

// Middleware Express pour logger les requêtes
logger.middleware = (): ((req: Request, res: Response, next: NextFunction) => void) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const start = Date.now();

        res.on('finish', () => {
            const duration = Date.now() - start;
            const level = res.statusCode >= 400 ? 'warn' : 'info';

            logger[level](`${req.method} ${req.originalUrl}`, {
                status: res.statusCode,
                duration: `${duration}ms`,
                ip: req.ip,
            });
        });

        next();
    };
};

export default logger;
