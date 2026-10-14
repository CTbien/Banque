// Middleware d'authentification
const auth = (req, res, next) => {
    // Permet aux tests ou requêtes de spécifier l'utilisateur connecté via headers
    const userIdHeader = req.headers['x-user-id'];
    const isAdminHeader = req.headers['x-is-admin'];

    if (userIdHeader) {
        req.user = { id: parseInt(userIdHeader, 10), is_admin: isAdminHeader === 'true' };
        return next();
    }

    // Utilisateur par défaut si non spécifié
    req.user = req.user || { id: 2, is_admin: false };
    next();
};

export default auth;
