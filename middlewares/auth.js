const jwt = require('jsonwebtoken');

/**
 * Middleware de vérification de token JWT pour routes protégées
 * - Vérifie que le token existe et commence par "Bearer"
 * - Décode le token avec la clé secrète (JWT_SECRET)
 * - Attache les infos décodées à `req.user`
 * - Sinon : renvoie une erreur 401
 */
module.exports = function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;

    // ❌ Pas d'en-tête ou format incorrect
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token manquant ou invalide' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // ✅ Ajoute le payload décodé (ex: { admin: true }) dans la requête
        req.user = decoded;

        // Autorise la suite du traitement
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token expiré ou invalide' });
    }
};
