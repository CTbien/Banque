import express from 'express';
import authController from '../controllers/authController.js';
import auth from '../middlewares/auth.js';

const router = express.Router();

// Routes publiques
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

// Route privée (profil de l'utilisateur connecté)
router.get('/me', auth, authController.me);

export default router;
