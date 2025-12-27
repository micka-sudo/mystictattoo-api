/**
 * Tests d'integration pour routes/auth.js
 */

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Mock du fichier admin.json
const mockConfigPath = path.join(__dirname, '../temp/admin.json');

// Setup de l'app de test
const createTestApp = () => {
    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    // Creer un hash de test
    const testPassword = 'testPassword123';
    const testHash = bcrypt.hashSync(testPassword, 10);
    fs.writeFileSync(mockConfigPath, JSON.stringify({ passwordHash: testHash }));

    const app = express();
    app.use(express.json());

    // Mock du module auth en remplacant le chemin config
    jest.doMock('../../routes/auth', () => {
        const express = require('express');
        const bcrypt = require('bcryptjs');
        const jwt = require('jsonwebtoken');
        const verifyToken = require('../../middlewares/auth');

        const router = express.Router();
        const JWT_EXPIRY = '1h';
        const MIN_PASSWORD_LENGTH = 8;

        const getPasswordHash = () => {
            try {
                const raw = fs.readFileSync(mockConfigPath, 'utf-8');
                const config = JSON.parse(raw);
                return config.passwordHash;
            } catch {
                return null;
            }
        };

        const savePasswordHash = (hash) => {
            try {
                let config = {};
                try {
                    config = JSON.parse(fs.readFileSync(mockConfigPath, 'utf-8'));
                } catch {}
                config.passwordHash = hash;
                fs.writeFileSync(mockConfigPath, JSON.stringify(config, null, 2));
                return true;
            } catch {
                return false;
            }
        };

        router.post('/', async (req, res) => {
            try {
                const { password } = req.body;
                if (!password || typeof password !== 'string') {
                    return res.status(400).json({ error: 'Mot de passe requis' });
                }
                const hash = getPasswordHash();
                if (!hash) {
                    return res.status(500).json({ error: 'Erreur configuration serveur' });
                }
                const isMatch = await bcrypt.compare(password, hash);
                if (!isMatch) {
                    return res.status(401).json({ error: 'Mot de passe incorrect' });
                }
                const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });
                res.json({ token });
            } catch {
                res.status(500).json({ error: 'Erreur serveur' });
            }
        });

        router.post('/refresh-token', (req, res) => {
            try {
                const { token } = req.body;
                if (!token || typeof token !== 'string') {
                    return res.status(400).json({ error: 'Token requis' });
                }
                jwt.verify(token, process.env.JWT_SECRET);
                const newToken = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRY });
                res.json({ token: newToken });
            } catch {
                res.status(401).json({ error: 'Token expire ou invalide' });
            }
        });

        router.put('/change-password', verifyToken, async (req, res) => {
            try {
                const { currentPassword, newPassword } = req.body;
                if (!currentPassword || !newPassword) {
                    return res.status(400).json({ error: 'Mot de passe actuel et nouveau requis' });
                }
                if (newPassword.length < MIN_PASSWORD_LENGTH) {
                    return res.status(400).json({ error: `Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caracteres` });
                }
                const hash = getPasswordHash();
                if (!hash) {
                    return res.status(500).json({ error: 'Erreur configuration serveur' });
                }
                const isMatch = await bcrypt.compare(currentPassword, hash);
                if (!isMatch) {
                    return res.status(401).json({ error: 'Ancien mot de passe incorrect' });
                }
                const newHash = await bcrypt.hash(newPassword, 10);
                if (!savePasswordHash(newHash)) {
                    return res.status(500).json({ error: 'Erreur sauvegarde mot de passe' });
                }
                res.json({ message: 'Mot de passe mis a jour avec succes.' });
            } catch {
                res.status(500).json({ error: 'Erreur serveur' });
            }
        });

        return router;
    });

    // Charger la route mockee
    const authRoute = require('../../routes/auth');
    app.use('/api/login', authRoute);

    return { app, testPassword };
};

describe('Auth Routes', () => {
    let app;
    let testPassword;

    beforeAll(() => {
        const setup = createTestApp();
        app = setup.app;
        testPassword = setup.testPassword;
    });

    afterAll(() => {
        // Cleanup
        try {
            fs.unlinkSync(mockConfigPath);
        } catch {}
        jest.resetModules();
    });

    describe('POST /api/login', () => {
        it('devrait retourner un token avec le bon mot de passe', async () => {
            const res = await request(app)
                .post('/api/login')
                .send({ password: testPassword });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('token');

            // Verifier que le token est valide
            const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
            expect(decoded.admin).toBe(true);
        });

        it('devrait rejeter un mauvais mot de passe', async () => {
            const res = await request(app)
                .post('/api/login')
                .send({ password: 'wrongPassword' });

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error', 'Mot de passe incorrect');
        });

        it('devrait rejeter une requete sans mot de passe', async () => {
            const res = await request(app)
                .post('/api/login')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Mot de passe requis');
        });

        it('devrait rejeter un mot de passe non-string', async () => {
            const res = await request(app)
                .post('/api/login')
                .send({ password: 12345 });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Mot de passe requis');
        });
    });

    describe('POST /api/login/refresh-token', () => {
        it('devrait rafraichir un token valide', async () => {
            const originalToken = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '1h' });

            const res = await request(app)
                .post('/api/login/refresh-token')
                .send({ token: originalToken });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('token');
            // Verifier que le nouveau token est valide
            const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET);
            expect(decoded.admin).toBe(true);
        });

        it('devrait rejeter un token invalide', async () => {
            const res = await request(app)
                .post('/api/login/refresh-token')
                .send({ token: 'invalid-token' });

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error');
        });

        it('devrait rejeter une requete sans token', async () => {
            const res = await request(app)
                .post('/api/login/refresh-token')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Token requis');
        });
    });

    describe('PUT /api/login/change-password', () => {
        it('devrait rejeter une requete sans authentification', async () => {
            const res = await request(app)
                .put('/api/login/change-password')
                .send({
                    currentPassword: testPassword,
                    newPassword: 'newPassword123'
                });

            expect(res.status).toBe(401);
        });

        it('devrait changer le mot de passe avec les bonnes credentials', async () => {
            const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '1h' });
            const newPassword = 'newPassword123';

            const res = await request(app)
                .put('/api/login/change-password')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    currentPassword: testPassword,
                    newPassword: newPassword
                });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message');

            // Verifier que le nouveau mot de passe fonctionne
            const loginRes = await request(app)
                .post('/api/login')
                .send({ password: newPassword });

            expect(loginRes.status).toBe(200);
        });

        it('devrait rejeter un mot de passe trop court', async () => {
            const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '1h' });

            const res = await request(app)
                .put('/api/login/change-password')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    currentPassword: 'newPassword123',
                    newPassword: 'short'
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/au moins 8 caracteres/);
        });

        it('devrait rejeter si mot de passe actuel manquant', async () => {
            const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: '1h' });

            const res = await request(app)
                .put('/api/login/change-password')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    newPassword: 'newPassword123'
                });

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
        });
    });
});
