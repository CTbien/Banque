const express = require('express');
const router = express.Router();

// On importe ton contrôleur
const compteController = require('../controllers/compteController');

// On importe les middlewares créés par le Développeur A
const auth = require('../middlewares/auth');
const isAdmin = require('../middlewares/isAdmin');

// Créer un compte bancaire
router.post('/', auth, compteController.creerCompte);

// Obtenir la liste de ses comptes
router.get('/', auth, compteController.getMesComptes);

// Voir les détails d'un compte précis
router.get('/:id', auth, compteController.getDetailCompte);

// Clôturer/supprimer un compte (si solde = 0)
router.delete('/:id', auth, compteController.supprimerCompte);

// Bloquer ou débloquer un compte (réservé aux admins)
router.patch('/:id/statut', auth, isAdmin, compteController.modifierStatut);

module.exports = router;