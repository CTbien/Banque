// csrf.js : protection CSRF (méthode "double submit cookie" avec csrf-csrf).
// 1. Le front récupère un jeton : GET /api/auth/csrf-token
// 2. Il le renvoie dans l'en-tête "x-csrf-token" de chaque POST / PUT / PATCH / DELETE.
// Un site pirate ne peut pas lire ce jeton, donc ses requêtes sont refusées (403).

import { doubleCsrf } from 'csrf-csrf';

const isProd = process.env.NODE_ENV === 'production';

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET,
    // Le jeton est lié au JWT : après connexion/déconnexion, il faut en redemander un.
    getSessionIdentifier: (req) => req.cookies?.token ?? '',
    // Le préfixe __Host- exige HTTPS : seulement en production.
    cookieName: isProd ? '__Host-kampus.x-csrf-token' : 'kampus.x-csrf-token',
    cookieOptions: { sameSite: 'strict', secure: isProd },
    // Jeton lu dans l'en-tête (fetch) ou dans le champ caché _csrf (formulaire HTML).
    getCsrfTokenFromRequest: (req) => req.headers['x-csrf-token'] ?? req.body?._csrf
});

// Middleware à placer dans app.js : vérifie le jeton (GET/HEAD/OPTIONS ignorés).
export const csrfProtection = doubleCsrfProtection;

// GET /api/auth/csrf-token : donne un jeton au front.
export const getCsrfToken = (req, res) => {
    res.json({ csrfToken: generateCsrfToken(req, res) });
};
