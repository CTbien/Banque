// userRoutes.js : URL du profil et de la gestion des clients (/api/users/...).

import express from 'express';
import userController from '../controllers/userController.js';
import auth from '../middlewares/auth.js';
import isAdmin from '../middlewares/isAdmin.js';
import {
    updateProfileRules, changePasswordRules, idParamRule, searchRules, validate
} from '../middlewares/validators.js';

const router = express.Router();

// Toutes les routes de ce fichier exigent d'être connecté.
router.use(auth);

// Client connecté : son propre profil
// (placées AVANT /:id, sinon Express prendrait "me" pour un id)
router.put('/me', updateProfileRules, validate, userController.updateMe);
router.put('/me/password', changePasswordRules, validate, userController.changePassword);

// Admin uniquement (isAdmin renvoie 403 aux clients)
router.get('/', isAdmin, searchRules, validate, userController.list);
router.get('/stats', isAdmin, userController.stats);
router.get('/:id', isAdmin, idParamRule, validate, userController.getOne);
router.put('/:id', isAdmin, idParamRule, updateProfileRules, validate, userController.update);
router.delete('/:id', isAdmin, idParamRule, validate, userController.remove);

export default router;
