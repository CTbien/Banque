// isAdmin.js : bloque les routes réservées aux administrateurs.
// À placer APRÈS auth : router.get('/', auth, isAdmin, controller.maFonction);

const isAdmin = (req, res, next) => {
    // req.user est rempli par le middleware auth.
    if (!req.user?.is_admin) {
        return res.status(403).json({ message: 'Accès réservé aux administrateurs.' });
    }

    next(); // c'est un admin : on continue
};

export default isAdmin;
