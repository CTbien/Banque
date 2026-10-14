import express from 'express';
import authController from '../controllers/authController.js';
import auth from '../middlewares/auth.js';
import { registerRules, loginRules, validate } from '../middlewares/validators.js';
import { loginLimiter } from '../middlewares/rateLimiter.js';
import { getCsrfToken } from '../middlewares/csrf.js';

const router = express.Router();

// Jeton CSRF à demander avant un formulaire (et à nouveau après login/logout)
router.get('/csrf-token', getCsrfToken);

// Routes publiques
router.post('/register', registerRules, validate, authController.register);
router.post('/login', loginLimiter, loginRules, validate, authController.login);
router.post('/logout', authController.logout);

// Route privée (profil de l'utilisateur connecté)
router.get('/me', auth, authController.me);

export default router;
