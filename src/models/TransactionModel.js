import pool from '../config/db.js';

class TransactionModel {
  // 1. Créer une transaction
  static async create(
    { compte_source_id = null, compte_destinataire_id = null, type_transaction, montant, description = null },
    connection = pool
  ) {
    const sql = `
      INSERT INTO transactions 
        (compte_source_id, compte_destinataire_id, type_transaction, montant, description)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await connection.execute(sql, [
      compte_source_id,
      compte_destinataire_id,
      type_transaction,
      montant,
      description
    ]);
    return result.insertId;
  }

  // 2. Récupérer les détails d'une transaction précise (+ getDetails() du diagramme)[cite: 1]
  static async getById(id) {
    const sql = `
      SELECT t.*, 
             cs.iban AS iban_source, 
             cd.iban AS iban_destinataire
      FROM transactions t
      LEFT JOIN comptes_bancaires cs ON t.compte_source_id = cs.id
      LEFT JOIN comptes_bancaires cd ON t.compte_destinataire_id = cd.id
      WHERE t.id = ?
    `;
    const [rows] = await pool.execute(sql, [id]);
    return rows[0];
  }

  // 3. Historique et filtres (+ filtrerParDate et + filtrerParType du diagramme)[cite: 1]
  static async filter({ compteId, dateDebut, dateFin, type_transaction }) {
    // On cherche toutes les lignes où le compte est SOIT la source, SOIT le destinataire.
    // Les jointures ajoutent l'IBAN de chaque côté (affiché par le front : "Virement reçu de ...").
    let sql = `
      SELECT t.*,
             cs.iban AS iban_source,
             cd.iban AS iban_destinataire
      FROM transactions t
      LEFT JOIN comptes_bancaires cs ON t.compte_source_id = cs.id
      LEFT JOIN comptes_bancaires cd ON t.compte_destinataire_id = cd.id
      WHERE (t.compte_source_id = ? OR t.compte_destinataire_id = ?)
    `;
    const params = [compteId, compteId];

    // Filtre optionnel par type ('depot', 'retrait', 'virement_emis', 'virement_recu')[cite: 1]
    if (type_transaction) {
      sql += ' AND t.type_transaction = ?';
      params.push(type_transaction);
    }

    // Filtre optionnel par plage de dates[cite: 1]
    if (dateDebut && dateFin) {
      sql += ' AND t.date_transaction BETWEEN ? AND ?';
      params.push(dateDebut, dateFin);
    }

    sql += ' ORDER BY t.date_transaction DESC, t.id DESC';

    const [rows] = await pool.execute(sql, params);
    return rows;
  }
}

export default TransactionModel;