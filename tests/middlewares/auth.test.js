/**
 * Tests pour middlewares/auth.js
 */

const jwt = require('jsonwebtoken');
const verifyToken = require('../../middlewares/auth');

describe('verifyToken middleware', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        mockReq = {
            headers: {}
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        mockNext = jest.fn();
    });

    it('devrait rejeter une requete sans header Authorization', () => {
        verifyToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token manquant ou invalide' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('devrait rejeter un header Authorization sans Bearer', () => {
        mockReq.headers.authorization = 'Basic sometoken';

        verifyToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token manquant ou invalide' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('devrait rejeter un token invalide', () => {
        mockReq.headers.authorization = 'Bearer invalid-token';

        verifyToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token expiré ou invalide' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('devrait rejeter un token expire', () => {
        const expiredToken = jwt.sign(
            { admin: true },
            process.env.JWT_SECRET,
            { expiresIn: '-1s' } // Token deja expire
        );
        mockReq.headers.authorization = `Bearer ${expiredToken}`;

        verifyToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token expiré ou invalide' });
        expect(mockNext).not.toHaveBeenCalled();
    });

    it('devrait accepter un token valide', () => {
        const validToken = jwt.sign(
            { admin: true },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        mockReq.headers.authorization = `Bearer ${validToken}`;

        verifyToken(mockReq, mockRes, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockReq.user).toBeDefined();
        expect(mockReq.user.admin).toBe(true);
    });

    it('devrait attacher le payload decode a req.user', () => {
        const payload = { admin: true, userId: 123, role: 'superadmin' };
        const validToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
        mockReq.headers.authorization = `Bearer ${validToken}`;

        verifyToken(mockReq, mockRes, mockNext);

        expect(mockReq.user).toMatchObject(payload);
    });

    it('devrait rejeter un token signe avec une mauvaise cle', () => {
        const wrongKeyToken = jwt.sign({ admin: true }, 'wrong-secret-key', { expiresIn: '1h' });
        mockReq.headers.authorization = `Bearer ${wrongKeyToken}`;

        verifyToken(mockReq, mockRes, mockNext);

        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockNext).not.toHaveBeenCalled();
    });
});
