import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, AuthPayload } from '../types';

export const JWT_ALGORITHM = 'HS256' as const;

// Tolérance d'horloge pour un iat légèrement dans le futur
const MAX_CLOCK_SKEW_SECONDS = 300;

/**
 * Vérifie un token admin et renvoie son payload, ou null s'il est invalide.
 * Rejette aussi les anciens tokens dont iat était en millisecondes :
 * leur exp était calculé des millénaires dans le futur.
 */
export const decodeAdminToken = (token: string): AuthPayload | null => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string, {
            algorithms: [JWT_ALGORITHM],
        }) as AuthPayload;

        const nowSeconds = Math.floor(Date.now() / 1000);
        if (typeof decoded.iat !== 'number' || decoded.iat > nowSeconds + MAX_CLOCK_SKEW_SECONDS) {
            return null;
        }
        if (decoded.admin !== true) {
            return null;
        }
        return decoded;
    } catch {
        return null;
    }
};

const getBearerToken = (req: Request): string | null => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.split(' ')[1] || null;
};

/**
 * Indique si la requête porte un token admin valide, sans la bloquer
 */
export const isAdminRequest = (req: Request): boolean => {
    const token = getBearerToken(req);
    return token !== null && decodeAdminToken(token) !== null;
};

/**
 * Middleware de vérification de token JWT pour routes protégées
 */
const verifyToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const token = getBearerToken(req);

    if (!token) {
        res.status(401).json({ error: 'Token manquant ou invalide' });
        return;
    }

    const decoded = decodeAdminToken(token);
    if (!decoded) {
        res.status(401).json({ error: 'Token expiré ou invalide' });
        return;
    }

    req.user = decoded;
    next();
};

export default verifyToken;
