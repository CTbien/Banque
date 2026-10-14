import express from 'express';
import compteController from '../controllers/compteController.js';
import auth from '../middlewares/auth.js';
import isAdmin from '../middlewares/isAdmin.js';

const router = express.Router();

router.post('/', auth, compteController.creerCompte);
router.get('/', auth, compteController.getMesComptes);
router.get('/:id', auth, compteController.getDetailCompte);
router.delete('/:id', auth, compteController.supprimerCompte);
router.patch('/:id/statut', auth, isAdmin, compteController.modifierStatut);

export default router;