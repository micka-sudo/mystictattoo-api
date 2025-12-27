import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, AuthPayload } from '../types';

/**
 * Middleware de vérification de token JWT pour routes protégées
 */
const verifyToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token manquant ou invalide' });
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as AuthPayload;
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ error: 'Token expiré ou invalide' });
    }
};

export default verifyToken;
