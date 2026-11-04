import express from 'express';
import compteController from '../controllers/compteController.js';
import auth from '../middlewares/auth.js';
import isAdmin from '../middlewares/isAdmin.js';
import { idParamRule, validate } from '../middlewares/validators.js';

const router = express.Router();

router.post('/', auth, compteController.creerCompte);
router.get('/', auth, compteController.getMesComptes);
// Placée AVANT /:id, sinon Express prendrait "tous" pour un id
router.get('/tous', auth, isAdmin, compteController.getTousLesComptes);
router.get('/:id', auth, idParamRule, validate, compteController.getDetailCompte);
router.delete('/:id', auth, idParamRule, validate, compteController.supprimerCompte);
router.patch('/:id/statut', auth, isAdmin, idParamRule, validate, compteController.modifierStatut);

export default router;