// =============================================================================
// UserModel — accès à la table `users`
// -----------------------------------------------------------------------------
// Le "modèle" est la SEULE couche qui parle SQL pour les utilisateurs.
// Les contrôleurs n'écrivent jamais de SQL : ils appellent ces méthodes.
// Avantage : si la table change, on ne modifie qu'ici.
//
// Toutes les méthodes sont `async` car MySQL répond de façon asynchrone :
// on les appelle avec `await UserModel.findById(3)`.
// =============================================================================

import pool from '../config/db.js';

// -----------------------------------------------------------------------------
// Colonnes "publiques" : tout SAUF `mot_de_passe`.
// On les liste explicitement au lieu de faire `SELECT *` pour que le hash du
// mot de passe ne sorte jamais par erreur dans une réponse JSON.
// -----------------------------------------------------------------------------
const PUBLIC_FIELDS = `
  id, nom, prenom, email, telephone, adresse_postale,
  date_naissance, is_admin, created_at
`;

// -----------------------------------------------------------------------------
// Colonnes qu'un utilisateur (ou un admin) a le droit de modifier via update().
// C'est une "liste blanche" : un champ absent de cette liste est ignoré.
// Sans elle, un client malin pourrait envoyer { is_admin: true } et devenir admin.
// -----------------------------------------------------------------------------
const UPDATABLE_FIELDS = [
  'nom',
  'prenom',
  'email',
  'telephone',
  'adresse_postale',
  'date_naissance'
];

class UserModel {
  // ---------------------------------------------------------------------------
  // 1. Créer un utilisateur (inscription)
  // ---------------------------------------------------------------------------
  // `mot_de_passe` reçu ici est DÉJÀ hashé par le contrôleur (bcrypt).
  // Le modèle ne fait que stocker : il ne connaît pas le mot de passe en clair.
  //
  // Les `?` sont des "placeholders" : mysql2 remplace chaque `?` par la valeur
  // correspondante du tableau, en l'échappant. C'est ce qui protège contre
  // l'injection SQL. Ne JAMAIS concaténer une valeur utilisateur dans le SQL.
  //
  // `?? null` : si un champ optionnel n'est pas fourni (undefined), on envoie
  // NULL à MySQL (mysql2 refuse undefined).
  static async create({ nom, prenom, email, telephone, adresse_postale, date_naissance, mot_de_passe }) {
    const sql = `
      INSERT INTO users
        (nom, prenom, email, telephone, adresse_postale, date_naissance, mot_de_passe)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [
      nom,
      prenom,
      email,
      telephone ?? null,
      adresse_postale ?? null,
      date_naissance ?? null,
      mot_de_passe
    ]);

    // `insertId` = l'id AUTO_INCREMENT que MySQL vient d'attribuer.
    return result.insertId;
  }

  // ---------------------------------------------------------------------------
  // 2. Trouver un utilisateur par email — POUR LA CONNEXION UNIQUEMENT
  // ---------------------------------------------------------------------------
  // C'est la seule méthode qui renvoie `mot_de_passe` (le hash), car le
  // contrôleur de login en a besoin pour bcrypt.compare().
  // Ne jamais renvoyer son résultat tel quel au client.
  //
  // `pool.execute` renvoie [lignes, métadonnées] ; on ne garde que les lignes.
  // `rows[0]` = le premier (et seul, car email UNIQUE) résultat, ou undefined.
  static async findByEmailWithPassword(email) {
    const sql = `SELECT ${PUBLIC_FIELDS}, mot_de_passe FROM users WHERE email = ?`;
    const [rows] = await pool.execute(sql, [email]);
    return rows[0];
  }

  // ---------------------------------------------------------------------------
  // 3. Vérifier si un email est déjà utilisé
  // ---------------------------------------------------------------------------
  // Utilisé à l'inscription et lors d'un changement d'email.
  // `excludeId` permet d'ignorer l'utilisateur lui-même : quand je modifie mon
  // profil sans changer mon email, il ne doit pas être considéré comme "pris".
  // `SELECT 1 ... LIMIT 1` : on ne veut pas les données, juste savoir s'il en existe une.
  static async emailExists(email, excludeId = null) {
    const sql = excludeId
      ? 'SELECT 1 FROM users WHERE email = ? AND id <> ? LIMIT 1'
      : 'SELECT 1 FROM users WHERE email = ? LIMIT 1';
    const params = excludeId ? [email, excludeId] : [email];
    const [rows] = await pool.execute(sql, params);
    return rows.length > 0;
  }

  // ---------------------------------------------------------------------------
  // 4. Trouver un utilisateur par id (SANS mot de passe)
  // ---------------------------------------------------------------------------
  // Utilisé par le tableau de bord, le profil, et l'admin (détail d'un client).
  static async findById(id) {
    const sql = `SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`;
    const [rows] = await pool.execute(sql, [id]);
    return rows[0];
  }

  // ---------------------------------------------------------------------------
  // 5. Récupérer le hash du mot de passe d'un utilisateur
  // ---------------------------------------------------------------------------
  // Utile pour "changer mon mot de passe" : on vérifie l'ancien avant d'accepter
  // le nouveau.
  static async getPasswordHash(id) {
    const [rows] = await pool.execute('SELECT mot_de_passe FROM users WHERE id = ?', [id]);
    return rows[0]?.mot_de_passe;
  }

  // ---------------------------------------------------------------------------
  // 6. Modifier les informations d'un utilisateur (profil ou admin)
  // ---------------------------------------------------------------------------
  // On construit dynamiquement "SET nom = ?, telephone = ?" avec SEULEMENT les
  // champs envoyés ET autorisés (liste blanche UPDATABLE_FIELDS).
  // Les NOMS de colonnes viennent de notre liste (sûrs), les VALEURS passent
  // par des `?` (échappées) : aucune injection possible.
  //
  // Renvoie true si une ligne a été modifiée, false sinon (id inexistant
  // ou aucun champ valide).
  static async update(id, data) {
    const fields = UPDATABLE_FIELDS.filter((field) => data[field] !== undefined);
    if (fields.length === 0) return false;

    const setClause = fields.map((field) => `${field} = ?`).join(', ');
    const values = fields.map((field) => data[field]);

    const sql = `UPDATE users SET ${setClause} WHERE id = ?`;
    const [result] = await pool.execute(sql, [...values, id]);

    // `affectedRows` = nombre de lignes trouvées par le WHERE.
    return result.affectedRows > 0;
  }

  // ---------------------------------------------------------------------------
  // 7. Modifier le mot de passe
  // ---------------------------------------------------------------------------
  // Séparé de update() exprès : le mot de passe ne doit jamais être modifiable
  // "par accident" via le formulaire de profil. `hash` est déjà hashé.
  static async updatePassword(id, hash) {
    const [result] = await pool.execute('UPDATE users SET mot_de_passe = ? WHERE id = ?', [hash, id]);
    return result.affectedRows > 0;
  }

  // ---------------------------------------------------------------------------
  // 8. Lister tous les clients (admin)
  // ---------------------------------------------------------------------------
  // On exclut les admins : l'espace admin gère les CLIENTS.
  // Tri par date d'inscription, les plus récents en premier.
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

  // ---------------------------------------------------------------------------
  // 9. Rechercher un client par nom, prénom, email ou numéro de compte (admin)
  // ---------------------------------------------------------------------------
  // `LIKE ?` avec `%texte%` = "contient texte" (ex : "dup" trouve "Dupont").
  // Le LEFT JOIN avec comptes_bancaires permet de chercher par IBAN : un client
  // sans compte reste trouvable par son nom grâce au LEFT (et non INNER) JOIN.
  // `DISTINCT` évite qu'un client ayant 3 comptes apparaisse 3 fois.
  // Les colonnes sont préfixées `u.` car les deux tables ont un `id`.
  static async search(term) {
    const like = `%${term}%`;
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

  // ---------------------------------------------------------------------------
  // 10. Supprimer un utilisateur (admin)
  // ---------------------------------------------------------------------------
  // ATTENTION : la clé étrangère `ON DELETE CASCADE` de comptes_bancaires
  // supprime aussi TOUS les comptes du client. Les transactions liées gardent
  // leur historique (ON DELETE SET NULL). D'où la confirmation exigée côté admin.
  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  // ---------------------------------------------------------------------------
  // 11. Compter les clients (statistiques admin)
  // ---------------------------------------------------------------------------
  // `COUNT(*) AS total` renvoie une ligne { total: 42 }.
  static async countClients() {
    const [rows] = await pool.execute('SELECT COUNT(*) AS total FROM users WHERE is_admin = FALSE');
    return rows[0].total;
  }
}

export default UserModel;
