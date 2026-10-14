const db = require('../config/db');

const CompteModel = {
    // Insère un nouveau compte avec solde à 0 et statut actif par défaut
    async creer(userId, iban, typeCompte) {
        const sql = "INSERT INTO comptes_bancaires (user_id, iban, type_compte, solde, statut) VALUES (?, ?, ?, 0.00, 'actif')";
        const [resultat] = await db.execute(sql, [userId, iban, typeCompte]);
        return resultat.insertId;
    },

    // Récupère la liste de tous les comptes d'un client
    async trouverParUtilisateur(userId) {
        const sql = "SELECT * FROM comptes_bancaires WHERE user_id = ?";
        const [lignes] = await db.execute(sql, [userId]);
        return lignes;
    },

    // Récupère un compte unique grâce à son identifiant
    async trouverParId(id) {
        const sql = "SELECT * FROM comptes_bancaires WHERE id = ?";
        const [lignes] = await db.execute(sql, [id]);
        return lignes[0];
    },

    // Supprime le compte uniquement si son solde est exactement à 0
    async supprimer(id) {
        const sql = "DELETE FROM comptes_bancaires WHERE id = ? AND solde = 0";
        const [resultat] = await db.execute(sql, [id]);
        return resultat.affectedRows > 0;
    },

    // Modifie le statut du compte ('actif' ou 'bloqué')
    async changerStatut(id, nouveauStatut) {
        const sql = "UPDATE comptes_bancaires SET statut = ? WHERE id = ?";
        const [resultat] = await db.execute(sql, [nouveauStatut, id]);
        return resultat.affectedRows > 0;
    }
};

module.exports = CompteModel;