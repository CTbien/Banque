// UserModel : toutes les requêtes SQL sur la table `users`.
// Les controllers appellent ces méthodes, ils n'écrivent jamais de SQL.

import pool from '../config/db.js';

// Colonnes renvoyables au navigateur (jamais le mot de passe).
const PUBLIC_FIELDS = `
  id, nom, prenom, email, telephone, adresse_postale,
  date_naissance, is_admin, created_at
`;

// Seuls ces champs sont modifiables par update() (empêche de passer is_admin à true).
const UPDATABLE_FIELDS = [
  'nom',
  'prenom',
  'email',
  'telephone',
  'adresse_postale',
  'date_naissance'
];

class UserModel {
  // Crée un utilisateur et renvoie son id.
  // Le mot de passe arrive déjà hashé par le controller.
  static async create({ nom, prenom, email, telephone, adresse_postale, date_naissance, mot_de_passe }) {
    // Les ? sont remplacés par les valeurs : protège contre l'injection SQL.
    const sql = `
      INSERT INTO users
        (nom, prenom, email, telephone, adresse_postale, date_naissance, mot_de_passe)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    // `?? null` : un champ vide devient NULL en base.
    const [result] = await pool.execute(sql, [
      nom,
      prenom,
      email,
      telephone ?? null,
      adresse_postale ?? null,
      date_naissance ?? null,
      mot_de_passe
    ]);
    return result.insertId;
  }

  // Trouve un utilisateur par email, AVEC son mot de passe hashé.
  // Réservé à la connexion : ne jamais renvoyer ce résultat au navigateur.
  static async findByEmailWithPassword(email) {
    const sql = `SELECT ${PUBLIC_FIELDS}, mot_de_passe FROM users WHERE email = ?`;
    const [rows] = await pool.execute(sql, [email]);
    return rows[0]; // undefined si introuvable
  }

  // Renvoie true si l'email est déjà pris.
  // excludeId : ignore l'utilisateur lui-même quand il modifie son profil.
  static async emailExists(email, excludeId = null) {
    const sql = excludeId
      ? 'SELECT 1 FROM users WHERE email = ? AND id <> ? LIMIT 1'
      : 'SELECT 1 FROM users WHERE email = ? LIMIT 1';
    const params = excludeId ? [email, excludeId] : [email];
    const [rows] = await pool.execute(sql, params);
    return rows.length > 0;
  }

  // Trouve un utilisateur par id, sans mot de passe.
  static async findById(id) {
    const sql = `SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`;
    const [rows] = await pool.execute(sql, [id]);
    return rows[0];
  }

  // Renvoie le mot de passe hashé (pour vérifier l'ancien avant d'en changer).
  static async getPasswordHash(id) {
    const [rows] = await pool.execute('SELECT mot_de_passe FROM users WHERE id = ?', [id]);
    return rows[0]?.mot_de_passe; // `?.` évite de planter si rien trouvé
  }

  // Modifie seulement les champs envoyés et autorisés.
  // Ex : { telephone: '0699999999' } → UPDATE users SET telephone = ? WHERE id = ?
  static async update(id, data) {
    const fields = UPDATABLE_FIELDS.filter((field) => data[field] !== undefined);
    if (fields.length === 0) return false;

    const setClause = fields.map((field) => `${field} = ?`).join(', ');
    const values = fields.map((field) => data[field]);

    const sql = `UPDATE users SET ${setClause} WHERE id = ?`;
    const [result] = await pool.execute(sql, [...values, id]);
    return result.affectedRows > 0; // false si l'id n'existe pas
  }

  // Change le mot de passe (déjà hashé). Séparé de update() par sécurité.
  static async updatePassword(id, hash) {
    const [result] = await pool.execute('UPDATE users SET mot_de_passe = ? WHERE id = ?', [hash, id]);
    return result.affectedRows > 0;
  }

  // Admin : liste tous les clients, du plus récent au plus ancien.
  static async findAllClients() {
    const sql = `
      SELECT ${PUBLIC_FIELDS}
      FROM users
      WHERE is_admin = FALSE
      ORDER BY created_at DESC
    `;
    const [rows] = await pool.execute(sql);
    return rows;
  }

  // Admin : cherche un client par nom, prénom, email ou IBAN.
  // LEFT JOIN garde les clients sans compte, DISTINCT évite les doublons.
  static async search(term) {
    const like = `%${term}%`; // %dup% = "contient dup"
    const sql = `
      SELECT DISTINCT
        u.id, u.nom, u.prenom, u.email, u.telephone, u.adresse_postale,
        u.date_naissance, u.is_admin, u.created_at
      FROM users u
      LEFT JOIN comptes_bancaires c ON c.user_id = u.id
      WHERE u.is_admin = FALSE
        AND (u.nom LIKE ? OR u.prenom LIKE ? OR u.email LIKE ? OR c.iban LIKE ?)
      ORDER BY u.nom, u.prenom
    `;
    const [rows] = await pool.execute(sql, [like, like, like, like]);
    return rows;
  }

  // Admin : supprime un utilisateur.
  // Attention : supprime aussi tous ses comptes (ON DELETE CASCADE).
  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // Admin : nombre total de clients (statistiques).
  static async countClients() {
    const [rows] = await pool.execute('SELECT COUNT(*) AS total FROM users WHERE is_admin = FALSE');
    return rows[0].total;
  }
}

export default UserModel;
