import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import verifyToken from '../middlewares/auth';
import { AuthenticatedRequest, AdminConfig } from '../types';

const router = Router();
const configPath = path.join(__dirname, '..', '..', 'config', 'admin.json');

// GET /api/config (protégé - admin seulement)
router.get('/', verifyToken, (req: AuthenticatedRequest, res: Response): void => {
    try {
        const config: AdminConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        res.json(config);
    } catch (err) {
        console.error('Erreur lecture admin.json :', err);
        res.status(500).json({ error: 'Erreur lecture configuration' });
    }
});

// POST /api/config
router.post('/', verifyToken, (req: AuthenticatedRequest, res: Response): void => {
    try {
        fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2));
        res.json({ message: 'Configuration mise à jour' });
    } catch (err) {
        console.error('Erreur écriture admin.json :', err);
        res.status(500).json({ error: 'Erreur écriture configuration' });
    }
});

export default router;
