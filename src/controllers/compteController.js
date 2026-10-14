// On importe le modèle que tu viens de créer
const CompteModel = require('../models/CompteModel');

// Petites fonctions pour fabriquer l'IBAN au format : FR76-YBNK-XXXX-XXXX-XXXX-XXXX-XXX
function quatreChiffres() {
    return Math.floor(1000 + Math.random() * 9000);
}
function troisChiffres() {
    return Math.floor(100 + Math.random() * 900);
}
function fabriquerIban() {
    return "FR76-YBNK-" + quatreChiffres() + "-" + quatreChiffres() + "-" + quatreChiffres() + "-" + quatreChiffres() + "-" + troisChiffres();
}

const compteController = {

    // 1. Créer un nouveau compte bancaire
    async creerCompte(req, res) {
        try {
            // req.user est fourni par le middleware d'authentification du Développeur A
            const userId = req.user.id;
            const { type_compte } = req.body;

            // Vérification : le type doit obligatoirement être l'un de ces trois-là
            const typesAutorises = ['courant', 'livret A', 'PEL'];
            if (!typesAutorises.includes(type_compte)) {
                return res.status(400).json({ message: "Type de compte invalide (choisir: courant, livret A ou PEL)." });
            }

            // On génère un IBAN au bon format
            const iban = fabriquerIban();

            // On demande au modèle d'insérer en base de données
            const nouveauCompteId = await CompteModel.creer(userId, iban, type_compte);

            return res.status(201).json({
                message: "Compte bancaire créé avec succès !",
                compteId: nouveauCompteId,
                iban: iban
            });
        } catch (erreur) {
            return res.status(500).json({ message: "Erreur serveur.", erreur: erreur.message });
        }
    },

    // 2. Voir tous les comptes de l'utilisateur connecté
    async getMesComptes(req, res) {
        try {
            const userId = req.user.id;
            const comptes = await CompteModel.trouverParUtilisateur(userId);
            return res.status(200).json(comptes);
        } catch (erreur) {
            return res.status(500).json({ message: "Erreur serveur.", erreur: erreur.message });
        }
    },

    // 3. Voir le détail d'un seul compte
    async getDetailCompte(req, res) {
        try {
            const compteId = req.params.id;
            const compte = await CompteModel.trouverParId(compteId);

            if (!compte) {
                return res.status(404).json({ message: "Compte introuvable." });
            }

            // Sécurité : on vérifie que le compte appartient bien au client connecté
            if (compte.user_id !== req.user.id && !req.user.is_admin) {
                return res.status(403).json({ message: "Accès refusé : ce compte ne vous appartient pas." });
            }

            return res.status(200).json(compte);
        } catch (erreur) {
            return res.status(500).json({ message: "Erreur serveur.", erreur: erreur.message });
        }
    },

    // 4. Supprimer un compte (règle obligatoire : solde = 0)
    async supprimerCompte(req, res) {
        try {
            const compteId = req.params.id;
            const compte = await CompteModel.trouverParId(compteId);

            if (!compte) {
                return res.status(404).json({ message: "Compte introuvable." });
            }

            // Sécurité propriétaire
            if (compte.user_id !== req.user.id && !req.user.is_admin) {
                return res.status(403).json({ message: "Accès refusé." });
            }

            // Règle du cahier des charges : interdiction de supprimer si le solde n'est pas à 0
            if (parseFloat(compte.solde) !== 0) {
                return res.status(400).json({
                    message: "Impossible de supprimer : le solde doit être exactement à 0.00 €."
                });
            }

            await CompteModel.supprimer(compteId);
            return res.status(200).json({ message: "Compte clôturé avec succès." });
        } catch (erreur) {
            return res.status(500).json({ message: "Erreur serveur.", erreur: erreur.message });
        }
    },

    // 5. Bloquer ou débloquer un compte (Action réservée à l'administrateur)
    async modifierStatut(req, res) {
        try {
            const compteId = req.params.id;
            const { statut } = req.body; // 'actif' ou 'bloqué'

            if (statut !== 'actif' && statut !== 'bloqué') {
                return res.status(400).json({ message: "Statut invalide. Utilisez 'actif' ou 'bloqué'." });
            }

            const misAJour = await CompteModel.changerStatut(compteId, statut);
            if (!misAJour) {
                return res.status(404).json({ message: "Compte introuvable." });
            }

            return res.status(200).json({ message: `Compte passé en statut : ${statut}` });
        } catch (erreur) {
            return res.status(500).json({ message: "Erreur serveur.", erreur: erreur.message });
        }
    }

};

module.exports = compteController;