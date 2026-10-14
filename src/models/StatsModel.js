// StatsModel : chiffres globaux pour le tableau de bord admin.

import pool from '../config/db.js';

class StatsModel {
    // Renvoie { total_clients, total_comptes, total_depots, solde_total } en une seule requête.
    // COALESCE(..., 0) : renvoie 0 au lieu de NULL quand il n'y a encore aucune ligne.
    static async getGlobalStats() {
        const sql = `
            SELECT
                (SELECT COUNT(*) FROM users WHERE is_admin = FALSE) AS total_clients,
                (SELECT COUNT(*) FROM comptes_bancaires) AS total_comptes,
                (SELECT COALESCE(SUM(montant), 0) FROM transactions WHERE type_transaction = 'depot') AS total_depots,
                (SELECT COALESCE(SUM(solde), 0) FROM comptes_bancaires) AS solde_total
        `;
        const [rows] = await pool.execute(sql);
        return rows[0];
    }
}

export default StatsModel;
