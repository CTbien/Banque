import express from 'express';
import transactionController from '../controllers/transactionController.js';

const router = express.Router();

// Opérations bancaires (POST car on envoie des données qui modifient la BDD)
router.post('/deposer', transactionController.deposer);
router.post('/retirer', transactionController.retirer);
router.post('/virement', transactionController.virerVers);

// Consultation (GET car on lit les données sans rien modifier)
router.get('/historique/:compteId', transactionController.getHistorique);

export default router;