import express from 'express';
import transactionController from '../controllers/transactionController.js';
import auth from '../middlewares/auth.js';
import { depotRules, retraitRules, virementRules, validate } from '../middlewares/validators.js';

const router = express.Router();

// Opérations bancaires (protégées par authentification)
router.post('/deposer', auth, depotRules, validate, transactionController.deposer);
router.post('/retirer', auth, retraitRules, validate, transactionController.retirer);
router.post('/virement', auth, virementRules, validate, transactionController.virerVers);

// Consultation (protégée par authentification)
router.get('/historique/:compteId', auth, transactionController.getHistorique);

export default router;