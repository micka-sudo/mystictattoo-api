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
        // Le hash du mot de passe ne sort jamais de l'API
        res.json({ showNewsOnHome: Boolean(config.showNewsOnHome) });
    } catch (err) {
        console.error('Erreur lecture admin.json :', err);
        res.status(500).json({ error: 'Erreur lecture configuration' });
    }
});

// POST /api/config
router.post('/', verifyToken, (req: AuthenticatedRequest, res: Response): void => {
    try {
        if (typeof req.body?.showNewsOnHome !== 'boolean') {
            res.status(400).json({ error: 'showNewsOnHome (booléen) requis' });
            return;
        }

        // Seul showNewsOnHome est modifiable : le reste du fichier (dont le hash) est conservé
        let current: Partial<AdminConfig> = {};
        try {
            current = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch {
            // Fichier absent : il sera créé
        }
        const updated = { ...current, showNewsOnHome: req.body.showNewsOnHome };
        fs.writeFileSync(configPath, JSON.stringify(updated, null, 2));
        res.json({ message: 'Configuration mise à jour' });
    } catch (err) {
        console.error('Erreur écriture admin.json :', err);
        res.status(500).json({ error: 'Erreur écriture configuration' });
    }
});

export default router;
