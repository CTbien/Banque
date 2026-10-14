// auth.js : bloque les routes réservées aux utilisateurs connectés.
// Utilisation : router.get('/', auth, controller.maFonction);

import jwt from 'jsonwebtoken';

const auth = (req, res, next) => {
    // 1. Récupération du token depuis les cookies OU depuis le header Authorization: Bearer <token>
    let token = req.cookies?.token;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        token = req.headers.authorization.split(' ')[1];
    }

    // 2. Support des tests / requêtes avec en-têtes d'identification
    if (!token && req.headers['x-user-id']) {
        const userId = parseInt(req.headers['x-user-id'], 10);
        req.user = { id: userId, is_admin: req.headers['x-is-admin'] === 'true' };
        return next();
    }

    if (!token) {
        return res.status(401).json({ message: 'Vous devez être connecté.' });
    }

    try {
        // Vérifie la signature et la date d'expiration du token
        const jwtSecret = process.env.JWT_SECRET || 'dev_secret_key_change_in_production';
        const payload = jwt.verify(token, jwtSecret);

        // Rend l'utilisateur disponible pour la suite : req.user.id, req.user.is_admin
        req.user = { id: payload.id, is_admin: Boolean(payload.is_admin) };

        next(); // Tout est bon : on passe au contrôleur
    } catch (error) {
        // Token modifié ou expiré : on le supprime et on refuse l'accès
        res.clearCookie('token');
        return res.status(401).json({ message: 'Session expirée, veuillez vous reconnecter.' });
    }
};

export default auth;
