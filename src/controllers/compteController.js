import CompteModel from '../models/CompteModel.js';

// Générateur d'IBAN au format FR76-YBNK-XXXX-XXXX-XXXX-XXXX-XXX
function fabriquerIban() {
    const quatreChiffres = () => Math.floor(1000 + Math.random() * 9000);
    const troisChiffres = () => Math.floor(100 + Math.random() * 900);
    return `FR76-YBNK-${quatreChiffres()}-${quatreChiffres()}-${quatreChiffres()}-${quatreChiffres()}-${troisChiffres()}`;
}

const compteController = {

    // POST /api/comptes : Création d'un nouveau compte
    async creerCompte(req, res) {
        try {
            const userId = req.user.id;
            const { type_compte } = req.body;

            const typesAutorises = ['courant', 'livret A', 'PEL'];
            if (!typesAutorises.includes(type_compte)) {
                return res.status(400).json({ message: "Type de compte invalide (courant, livret A ou PEL)." });
            }

            const iban = fabriquerIban();
            const compteId = await CompteModel.creer(userId, iban, type_compte);

            return res.status(201).json({ message: "Compte créé avec succès.", compteId, iban });
        } catch (erreur) {
            return res.status(500).json({ message: "Erreur serveur.", erreur: erreur.message });
        }
    },

    // GET /api/comptes : Consulter ses propres comptes
    async getMesComptes(req, res) {
        try {
            const comptes = await CompteModel.trouverParUtilisateur(req.user.id);
            return res.status(200).json(comptes);
        } catch (erreur) {
            return res.status(500).json({ message: "Erreur serveur.", erreur: erreur.message });
        }
    },

    // GET /api/comptes/:id : Consulter le détail d'un compte précis
    async getDetailCompte(req, res) {
        try {
            const compte = await CompteModel.trouverParId(req.params.id);
            if (!compte) {
                return res.status(404).json({ message: "Compte introuvable." });
            }

            if (compte.user_id !== req.user.id && !req.user.is_admin) {
                return res.status(403).json({ message: "Accès refusé." });
            }

            return res.status(200).json(compte);
        } catch (erreur) {
            return res.status(500).json({ message: "Erreur serveur.", erreur: erreur.message });
        }
    },

    // DELETE /api/comptes/:id : Clôturer un compte (solde doit être à 0)
    async supprimerCompte(req, res) {
        try {
            const compte = await CompteModel.trouverParId(req.params.id);
            if (!compte) {
                return res.status(404).json({ message: "Compte introuvable." });
            }

            if (compte.user_id !== req.user.id && !req.user.is_admin) {
                return res.status(403).json({ message: "Accès refusé." });
            }

            if (parseFloat(compte.solde) !== 0) {
                return res.status(400).json({ message: "Le solde doit être à 0.00 € pour supprimer le compte." });
            }

            await CompteModel.supprimer(req.params.id);
            return res.status(200).json({ message: "Compte clôturé avec succès." });
        } catch (erreur) {
            return res.status(500).json({ message: "Erreur serveur.", erreur: erreur.message });
        }
    },

    // PATCH /api/comptes/:id/statut : Bloquer ou débloquer un compte (Admin)
    async modifierStatut(req, res) {
        try {
            const { statut } = req.body;
            if (statut !== 'actif' && statut !== 'bloqué') {
                return res.status(400).json({ message: "Statut invalide ('actif' ou 'bloqué')." });
            }

            const misAJour = await CompteModel.changerStatut(req.params.id, statut);
            if (!misAJour) {
                return res.status(404).json({ message: "Compte introuvable." });
            }

            return res.status(200).json({ message: `Statut modifié : ${statut}` });
        } catch (erreur) {
            return res.status(500).json({ message: "Erreur serveur.", erreur: erreur.message });
        }
    }

};

export default compteController;