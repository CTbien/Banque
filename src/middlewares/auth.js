// Middleware d'authentification
const auth = (req, res, next) => {
    // Injecte un utilisateur par défaut pour le développement si non présent
    req.user = req.user || { id: 1, is_admin: false };
    next();
};

export default auth;
