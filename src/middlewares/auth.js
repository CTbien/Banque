// auth.js : bloque les routes réservées aux utilisateurs connectés.
// Utilisation : router.get('/', auth, controller.maFonction);

import jwt from 'jsonwebtoken';

const auth = (req, res, next) => {
    // Le token est dans le cookie "token" (lu grâce à cookie-parser).
    const token = req.cookies?.token;

    if (!token) {
        return res.status(401).json({ message: 'Vous devez être connecté.' });
    }

    try {
        // Vérifie la signature et la date d'expiration du token.
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        // Rend l'utilisateur disponible pour la suite : req.user.id, req.user.is_admin
        req.user = { id: payload.id, is_admin: Boolean(payload.is_admin) };

        next(); // tout est bon : on passe au controller
    } catch (error) {
        // Token modifié ou expiré : on le supprime et on refuse l'accès.
        res.clearCookie('token');
        return res.status(401).json({ message: 'Session expirée, veuillez vous reconnecter.' });
    }
};

export default auth;
