import express from 'express';
import transactionController from '../controllers/transactionController.js';
import auth from '../middlewares/auth.js';

const router = express.Router();

// Opérations bancaires (protégées par authentification)
router.post('/deposer', auth, transactionController.deposer);
router.post('/retirer', auth, transactionController.retirer);
router.post('/virement', auth, transactionController.virerVers);

// Consultation (protégée par authentification)
router.get('/historique/:compteId', auth, transactionController.getHistorique);

export default router;