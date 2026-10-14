// Middleware de vérification des droits administrateur
const isAdmin = (req, res, next) => {
    if (req.user && req.user.is_admin) {
        return next();
    }
    return res.status(403).json({ message: "Accès refusé : privilèges administrateur requis." });
};

export default isAdmin;
