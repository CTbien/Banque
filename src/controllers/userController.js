// userController.js : profil du client connecté + gestion des clients par l'admin.
// La validation des champs est faite avant, dans userRoutes.js.

import bcrypt from 'bcrypt';
import UserModel from '../models/UserModel.js';
import CompteModel from '../models/CompteModel.js';
import StatsModel from '../models/StatsModel.js';

const BCRYPT_ROUNDS = 10;

// Modifie un utilisateur (partagé entre le profil et l'admin).
async function modifierUtilisateur(id, data, res) {
    if (!(await UserModel.findById(id))) {
        return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }

    // Nouvel email déjà pris par quelqu'un d'autre ?
    if (data.email && await UserModel.emailExists(data.email, id)) {
        return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
    }

    // update() ignore les champs non autorisés (is_admin, mot_de_passe…).
    const modifie = await UserModel.update(id, data);
    if (!modifie) {
        return res.status(400).json({ message: 'Aucun champ à modifier.' });
    }

    const user = await UserModel.findById(id);
    return res.status(200).json({ message: 'Informations mises à jour.', user });
}

const userController = {

    // ========================= CLIENT CONNECTÉ =========================

    // PUT /api/users/me : modifier ses propres informations
    async updateMe(req, res) {
        try {
            return await modifierUtilisateur(req.user.id, req.body, res);
        } catch (erreur) {
            return res.status(500).json({ message: 'Erreur serveur.' });
        }
    },

    // PUT /api/users/me/password : changer son mot de passe
    async changePassword(req, res) {
        try {
            const { ancien_mot_de_passe, nouveau_mot_de_passe } = req.body;

            // On vérifie l'ancien mot de passe avant d'accepter le nouveau.
            const hashActuel = await UserModel.getPasswordHash(req.user.id);
            if (!hashActuel || !(await bcrypt.compare(ancien_mot_de_passe, hashActuel))) {
                return res.status(401).json({ message: 'Ancien mot de passe incorrect.' });
            }

            const nouveauHash = await bcrypt.hash(nouveau_mot_de_passe, BCRYPT_ROUNDS);
            await UserModel.updatePassword(req.user.id, nouveauHash);

            return res.status(200).json({ message: 'Mot de passe modifié.' });
        } catch (erreur) {
            return res.status(500).json({ message: 'Erreur serveur.' });
        }
    },

    // ========================= ADMIN =========================

    // GET /api/users?q=dup : lister les clients, ou rechercher (nom, prénom, email, IBAN)
    async list(req, res) {
        try {
            const q = req.query.q;
            const clients = q ? await UserModel.search(q) : await UserModel.findAllClients();
            return res.status(200).json(clients);
        } catch (erreur) {
            return res.status(500).json({ message: 'Erreur serveur.' });
        }
    },

    // GET /api/users/stats : nombre de clients, de comptes, total des dépôts
    async stats(req, res) {
        try {
            const stats = await StatsModel.getGlobalStats();
            return res.status(200).json(stats);
        } catch (erreur) {
            return res.status(500).json({ message: 'Erreur serveur.' });
        }
    },

    // GET /api/users/:id : détail d'un client et de ses comptes
    async getOne(req, res) {
        try {
            const user = await UserModel.findById(req.params.id);
            if (!user) {
                return res.status(404).json({ message: 'Utilisateur introuvable.' });
            }

            // Comptes du client (modèle du module Comptes).
            const comptes = await CompteModel.trouverParUtilisateur(user.id);
            return res.status(200).json({ user, comptes });
        } catch (erreur) {
            return res.status(500).json({ message: 'Erreur serveur.' });
        }
    },

    // PUT /api/users/:id : modifier les informations d'un client
    async update(req, res) {
        try {
            return await modifierUtilisateur(req.params.id, req.body, res);
        } catch (erreur) {
            return res.status(500).json({ message: 'Erreur serveur.' });
        }
    },

    // DELETE /api/users/:id : supprimer un client (body : { "confirmation": true })
    async remove(req, res) {
        try {
            // Le cahier des charges exige une confirmation.
            if (req.body?.confirmation !== true) {
                return res.status(400).json({ message: 'Confirmation requise : envoyez { "confirmation": true }.' });
            }

            const user = await UserModel.findById(req.params.id);
            if (!user) {
                return res.status(404).json({ message: 'Utilisateur introuvable.' });
            }

            // Un admin ne peut supprimer que des clients (ni lui-même, ni un autre admin).
            if (user.is_admin) {
                return res.status(403).json({ message: 'Impossible de supprimer un administrateur.' });
            }

            // Attention : supprime aussi tous ses comptes (ON DELETE CASCADE).
            await UserModel.delete(user.id);
            return res.status(200).json({ message: 'Client supprimé.' });
        } catch (erreur) {
            return res.status(500).json({ message: 'Erreur serveur.' });
        }
    }
};

export default userController;
