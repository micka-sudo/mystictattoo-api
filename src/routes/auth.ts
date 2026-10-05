import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import verifyToken, { decodeAdminToken, JWT_ALGORITHM } from '../middlewares/auth';
import { AuthenticatedRequest, AdminConfig } from '../types';

const router = Router();
const configPath = path.join(__dirname, '..', '..', 'config', 'admin.json');

const JWT_EXPIRY = process.env.JWT_EXPIRY || '30m';
const MIN_PASSWORD_LENGTH = 12;
const BCRYPT_COST = 12;

// Si défini (variable d'environnement Render), ce hash remplace celui de admin.json
const envPasswordHash = (): string | null => process.env.ADMIN_PASSWORD_HASH || null;

// iat est ajouté par jsonwebtoken, en secondes : ne pas le fournir soi-même
const signAdminToken = (): string => jwt.sign(
    { admin: true },
    process.env.JWT_SECRET as string,
    {
        algorithm: JWT_ALGORITHM,
        expiresIn: JWT_EXPIRY as jwt.SignOptions['expiresIn'],
    }
);

const getPasswordHash = (): string | null => {
    const fromEnv = envPasswordHash();
    if (fromEnv) return fromEnv;

    try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        const config: AdminConfig = JSON.parse(raw);
        return config.passwordHash || null;
    } catch (err) {
        console.error('Erreur lecture admin.json:', (err as Error).message);
        return null;
    }
};

const savePasswordHash = (hash: string): boolean => {
    try {
        let config: Partial<AdminConfig> = {};
        try {
            config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        } catch {
            // Fichier vide ou inexistant
        }
        config.passwordHash = hash;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return true;
    } catch (err) {
        console.error('Erreur écriture admin.json:', (err as Error).message);
        return false;
    }
};

// POST /api/login
router.post('/', async (req: Request, res: Response): Promise<void> => {
    try {
        const { password } = req.body;

        if (!password || typeof password !== 'string') {
            res.status(400).json({ error: 'Mot de passe requis' });
            return;
        }

        const hash = getPasswordHash();
        if (!hash) {
            res.status(500).json({ error: 'Erreur configuration serveur' });
            return;
        }

        const isMatch = await bcrypt.compare(password, hash);
        if (!isMatch) {
            res.status(401).json({ error: 'Mot de passe incorrect' });
            return;
        }

        res.json({ token: signAdminToken() });
    } catch (err) {
        console.error('Erreur login:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// POST /api/login/refresh-token
router.post('/refresh-token', (req: Request, res: Response): void => {
    try {
        const { token } = req.body;

        if (!token || typeof token !== 'string') {
            res.status(400).json({ error: 'Token requis' });
            return;
        }

        if (!decodeAdminToken(token)) {
            res.status(401).json({ error: 'Token expiré ou invalide' });
            return;
        }

        res.json({ token: signAdminToken() });
    } catch {
        console.warn('Token invalide ou expiré');
        res.status(401).json({ error: 'Token expiré ou invalide' });
    }
});

// PUT /api/login/change-password
router.put('/change-password', verifyToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
            res.status(400).json({ error: 'Mot de passe actuel et nouveau requis' });
            return;
        }

        if (envPasswordHash()) {
            res.status(409).json({
                error: 'Le mot de passe est défini par la variable ADMIN_PASSWORD_HASH sur Render : modifiez-le là-bas.'
            });
            return;
        }

        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            res.status(400).json({
                error: `Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`
            });
            return;
        }

        const hash = getPasswordHash();
        if (!hash) {
            res.status(500).json({ error: 'Erreur configuration serveur' });
            return;
        }

        const isMatch = await bcrypt.compare(currentPassword, hash);
        if (!isMatch) {
            res.status(401).json({ error: 'Ancien mot de passe incorrect' });
            return;
        }

        const newHash = await bcrypt.hash(newPassword, BCRYPT_COST);
        if (!savePasswordHash(newHash)) {
            res.status(500).json({ error: 'Erreur sauvegarde mot de passe' });
            return;
        }

        res.json({ message: 'Mot de passe mis à jour avec succès.' });
    } catch (err) {
        console.error('Erreur changement mot de passe:', err);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;
