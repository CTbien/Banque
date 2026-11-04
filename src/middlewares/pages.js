// pages.js : bloque l'accès aux pages HTML réservées.
// Même rôle que auth et isAdmin, mais redirige au lieu de répondre en JSON.

import jwt from 'jsonwebtoken';

// Renvoie le contenu du token, ou null s'il est absent, modifié ou expiré.
const lireToken = (req) => {
    try {
        return jwt.verify(req.cookies?.token ?? '', process.env.JWT_SECRET);
    } catch (erreur) {
        return null;
    }
};

// Page réservée aux utilisateurs connectés
export const pageConnecte = (req, res, next) => {
    if (!lireToken(req)) return res.redirect('/login.html');
    next();
};

// Page réservée aux administrateurs
export const pageAdmin = (req, res, next) => {
    const user = lireToken(req);
    if (!user) return res.redirect('/login.html');
    if (!user.is_admin) return res.redirect('/dashboard.html');
    next();
};
