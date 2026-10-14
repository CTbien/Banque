// rateLimiter.js : bloque temporairement après trop de tentatives de connexion ratées.

import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,      // fenêtre de 15 minutes
    limit: 5,                      // 5 essais ratés max par adresse IP
    skipSuccessfulRequests: true,  // une connexion réussie ne compte pas
    standardHeaders: 'draft-8',    // indique au client quand réessayer
    legacyHeaders: false,          // désactive les anciens en-têtes X-RateLimit-*
    message: { message: 'Trop de tentatives. Réessayez dans 15 minutes.' }
});
