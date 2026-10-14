// =============================================================================
//  UserModel.js — Toutes les requêtes SQL qui concernent la table `users`
// =============================================================================
//
//  À QUOI SERT CE FICHIER ?
//  ------------------------
//  Le projet suit l'architecture MVC :
//    - Model      (ce fichier)   → parle à la base de données (SQL)
//    - Controller (authController.js, userController.js) → contient la logique
//                                  (vérifier un mot de passe, créer un token…)
//    - Route      (authRoutes.js) → associe une URL à une fonction du controller
//
//  Règle : SEUL le modèle écrit du SQL. Le controller se contente d'appeler
//  `UserModel.findById(3)` sans savoir comment c'est fait.
//  Si demain une colonne change de nom, on ne modifie QUE ce fichier.
//
//  POURQUOI `async` / `await` PARTOUT ?
//  ------------------------------------
//  Interroger MySQL prend du temps (quelques millisecondes). Pendant ce temps,
//  Node.js ne doit pas rester bloqué : il continue à servir les autres clients.
//    - `async` devant une fonction = "cette fonction renvoie une promesse"
//    - `await` devant un appel     = "attends le résultat avant la ligne suivante"
//  Exemple d'utilisation dans un controller :
//      const user = await UserModel.findById(3);
//
// =============================================================================


// On importe le "pool" de connexions MySQL défini dans src/config/db.js.
// `pool` est partagé par toute l'application : on ne crée pas une nouvelle
// connexion à chaque requête, on en emprunte une déjà ouverte.
import pool from '../config/db.js';


// =============================================================================
//  CONSTANTES
// =============================================================================

// Liste des colonnes qu'on a le droit de renvoyer au navigateur.
// → Toutes les colonnes de `users` SAUF `mot_de_passe`.
//
// Pourquoi ne pas écrire `SELECT *` ?
//   Parce que `*` renverrait aussi le hash du mot de passe, et il finirait
//   un jour par apparaître dans une réponse JSON envoyée au navigateur.
//   En listant les colonnes une par une, l'oubli devient impossible.
//
// Les backticks ` ` créent une "template string" : une chaîne qui peut tenir
// sur plusieurs lignes et dans laquelle on peut insérer des variables avec ${…}.
const PUBLIC_FIELDS = `
  id, nom, prenom, email, telephone, adresse_postale,
  date_naissance, is_admin, created_at
`;

// Liste des colonnes qu'on a le droit de MODIFIER avec la méthode update().
// C'est une "liste blanche" (whitelist) : tout ce qui n'est pas dedans est ignoré.
//
// Pourquoi ? Imaginons qu'un client envoie ce JSON au formulaire de profil :
//     { "nom": "Dupont", "is_admin": true }
// Sans liste blanche, il deviendrait administrateur.
// Avec elle, `is_admin` n'est pas dans la liste → il est tout simplement ignoré.
// (Même chose pour `mot_de_passe` et `id` : ils ont leurs propres méthodes.)
const UPDATABLE_FIELDS = [
  'nom',
  'prenom',
  'email',
  'telephone',
  'adresse_postale',
  'date_naissance'
];


// =============================================================================
//  LA CLASSE UserModel
// =============================================================================
//
// Une classe regroupe des fonctions qui vont ensemble.
// Le mot `static` devant chaque méthode veut dire qu'on l'appelle directement
// sur la classe, sans faire `new UserModel()` :
//     UserModel.findById(3)        ✅
//     new UserModel().findById(3)  ❌ inutile ici
//
// (C'est le même style que TransactionModel.js écrit par le développeur C.)

class UserModel {

  // ===========================================================================
  //  1. CRÉER UN UTILISATEUR  (utilisé par : l'inscription)
  // ===========================================================================
  //
  //  Reçoit un objet comme :
  //    {
  //      nom: 'Dupont', prenom: 'Marie', email: 'marie@mail.fr',
  //      telephone: '0612345678', adresse_postale: '1 rue de Paris',
  //      date_naissance: '1999-05-12',
  //      mot_de_passe: '$2b$10$N9qo8uLO...'   ← DÉJÀ hashé par le controller
  //    }
  //  Renvoie : l'id du nouvel utilisateur, par ex. 7
  //
  //  Les accolades dans les paramètres `({ nom, prenom, ... })` s'appellent la
  //  "déstructuration" : au lieu d'écrire `data.nom`, `data.prenom`…, on
  //  récupère directement chaque propriété dans une variable du même nom.
  //
  static async create({ nom, prenom, email, telephone, adresse_postale, date_naissance, mot_de_passe }) {

    // La requête SQL. Chaque `?` est un "emplacement" qui sera rempli par
    // mysql2 avec la valeur correspondante du tableau ci-dessous, DANS L'ORDRE :
    //   1er ? → nom, 2e ? → prenom, 3e ? → email, etc.
    //
    // ⚠️ SÉCURITÉ — pourquoi des `?` et pas `VALUES ('${nom}', ...)` ?
    // Si on collait directement le texte tapé par l'utilisateur dans le SQL,
    // quelqu'un pourrait taper comme nom :   x'); DROP TABLE users; --
    // et détruire la table. C'est "l'injection SQL".
    // Avec les `?`, mysql2 "échappe" les valeurs : elles sont toujours traitées
    // comme du texte, jamais comme du code SQL.
    const sql = `
      INSERT INTO users
        (nom, prenom, email, telephone, adresse_postale, date_naissance, mot_de_passe)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    // pool.execute(sql, valeurs) envoie la requête à MySQL.
    //
    // Il renvoie un tableau de 2 éléments : [résultat, infos_sur_les_colonnes].
    // On n'a besoin que du premier, d'où `const [result] = ...`
    // (déstructuration de tableau : on prend le 1er élément et on ignore le reste).
    //
    // `telephone ?? null` : l'opérateur `??` veut dire
    //   "si telephone vaut undefined ou null, utilise null à la place".
    //   Nécessaire car mysql2 accepte null (= NULL en SQL) mais plante sur undefined.
    //   Ça concerne les champs facultatifs que l'utilisateur a pu laisser vides.
    const [result] = await pool.execute(sql, [
      nom,
      prenom,
      email,
      telephone ?? null,
      adresse_postale ?? null,
      date_naissance ?? null,
      mot_de_passe
    ]);

    // Pour un INSERT, `result` ressemble à : { affectedRows: 1, insertId: 7, ... }
    // `insertId` = l'id que MySQL vient de générer automatiquement (AUTO_INCREMENT).
    return result.insertId;
  }


  // ===========================================================================
  //  2. TROUVER PAR EMAIL, AVEC LE MOT DE PASSE  (utilisé par : la connexion)
  // ===========================================================================
  //
  //  Reçoit : 'marie@mail.fr'
  //  Renvoie : { id: 7, nom: 'Dupont', ..., mot_de_passe: '$2b$10$...' }
  //            ou undefined si aucun utilisateur n'a cet email.
  //
  //  ⚠️ C'est la SEULE méthode qui renvoie le hash du mot de passe.
  //  Le controller de connexion en a besoin pour faire :
  //      bcrypt.compare(motDePasseTapé, user.mot_de_passe)
  //  Il ne faut JAMAIS renvoyer cet objet tel quel au navigateur.
  //  Le nom de la méthode est long exprès, pour qu'on ne l'utilise pas par erreur.
  //
  static async findByEmailWithPassword(email) {

    // `${PUBLIC_FIELDS}` insère la liste de colonnes définie en haut du fichier.
    // On y ajoute `mot_de_passe` uniquement ici.
    // (Insérer PUBLIC_FIELDS avec ${} est sans danger : c'est NOTRE texte,
    //  pas celui de l'utilisateur. L'email, lui, passe bien par un `?`.)
    const sql = `SELECT ${PUBLIC_FIELDS}, mot_de_passe FROM users WHERE email = ?`;

    // Pour un SELECT, le premier élément renvoyé est un TABLEAU de lignes :
    //   [ { id: 7, nom: 'Dupont', ... } ]   ou   []  si rien trouvé
    const [rows] = await pool.execute(sql, [email]);

    // L'email est UNIQUE en base → il y a au maximum une ligne.
    // rows[0] = cette ligne, ou undefined si le tableau est vide.
    return rows[0];
  }


  // ===========================================================================
  //  3. L'EMAIL EST-IL DÉJÀ PRIS ?  (utilisé par : inscription, modif. profil)
  // ===========================================================================
  //
  //  Reçoit : un email, et éventuellement l'id d'un utilisateur à ignorer.
  //  Renvoie : true (déjà pris) ou false (libre).
  //
  //  Pourquoi `excludeId` ?
  //    Quand Marie (id 7) modifie son téléphone, son formulaire renvoie aussi
  //    son email 'marie@mail.fr'. Sans exclusion, la requête trouverait… Marie
  //    elle-même, et refuserait la modification ("email déjà utilisé").
  //    On cherche donc : "un AUTRE utilisateur que le 7 a-t-il cet email ?"
  //
  //  `excludeId = null` dans les paramètres = valeur par défaut si on ne le
  //  fournit pas. À l'inscription on appelle simplement emailExists(email).
  //
  static async emailExists(email, excludeId = null) {

    // Opérateur ternaire :  condition ? siVrai : siFaux
    // `<>` signifie "différent de" en SQL.
    //
    // `SELECT 1 ... LIMIT 1` : on ne veut récupérer aucune donnée, juste savoir
    // s'il existe AU MOINS une ligne. `LIMIT 1` dit à MySQL d'arrêter de
    // chercher dès qu'il en a trouvé une → plus rapide.
    const sql = excludeId
      ? 'SELECT 1 FROM users WHERE email = ? AND id <> ? LIMIT 1'
      : 'SELECT 1 FROM users WHERE email = ? LIMIT 1';

    // Le tableau de valeurs doit avoir autant d'éléments que de `?` dans la requête.
    const params = excludeId ? [email, excludeId] : [email];

    const [rows] = await pool.execute(sql, params);

    // Au moins une ligne trouvée → l'email est pris.
    return rows.length > 0;
  }


  // ===========================================================================
  //  4. TROUVER PAR ID, SANS MOT DE PASSE
  //     (utilisé par : tableau de bord, profil, détail d'un client côté admin)
  // ===========================================================================
  //
  //  Reçoit : 7
  //  Renvoie : { id: 7, nom: 'Dupont', prenom: 'Marie', ... }  (sans mot_de_passe)
  //            ou undefined si l'id n'existe pas.
  //
  //  C'est la méthode "normale" pour lire un utilisateur : son résultat peut
  //  être envoyé au navigateur sans risque.
  //
  static async findById(id) {
    const sql = `SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ?`;
    const [rows] = await pool.execute(sql, [id]);
    return rows[0];
  }


  // ===========================================================================
  //  5. RÉCUPÉRER LE HASH DU MOT DE PASSE  (utilisé par : changer de mot de passe)
  // ===========================================================================
  //
  //  Reçoit : 7
  //  Renvoie : '$2b$10$N9qo8uLO...'  ou undefined.
  //
  //  Pour changer de mot de passe, on demande l'ANCIEN mot de passe et on le
  //  vérifie avec bcrypt.compare() avant d'accepter le nouveau. Ainsi, quelqu'un
  //  qui trouve un ordinateur resté connecté ne peut pas changer le mot de passe.
  //
  static async getPasswordHash(id) {
    const [rows] = await pool.execute('SELECT mot_de_passe FROM users WHERE id = ?', [id]);

    // `?.` = "chaînage optionnel".
    // Si rows[0] existe        → on lit rows[0].mot_de_passe
    // Si rows[0] est undefined → on renvoie undefined au lieu de PLANTER
    //   (sans `?.`, on aurait l'erreur "Cannot read properties of undefined").
    return rows[0]?.mot_de_passe;
  }


  // ===========================================================================
  //  6. MODIFIER LES INFORMATIONS  (utilisé par : profil client, admin)
  // ===========================================================================
  //
  //  Reçoit : 7, { telephone: '0699999999', is_admin: true }
  //  Renvoie : true si l'utilisateur a été trouvé et mis à jour, false sinon.
  //
  //  Le problème : on ne sait pas à l'avance QUELS champs l'utilisateur modifie
  //  (parfois juste le téléphone, parfois nom + adresse…).
  //  La solution : on construit la requête SQL au fur et à mesure.
  //
  //  Déroulé avec l'exemple ci-dessus :
  //
  static async update(id, data) {

    // ÉTAPE 1 — Garder uniquement les champs autorisés ET présents dans `data`.
    // `.filter()` parcourt la liste et ne garde que les éléments pour lesquels
    // la fonction renvoie true.
    //   UPDATABLE_FIELDS = ['nom','prenom','email','telephone','adresse_postale','date_naissance']
    //   data.telephone existe, les autres sont undefined
    //   → fields = ['telephone']
    //   (`is_admin` n'est même pas regardé : il n'est pas dans la liste blanche.)
    const fields = UPDATABLE_FIELDS.filter((field) => data[field] !== undefined);

    // Si rien d'autorisé n'a été envoyé, inutile d'interroger la base.
    if (fields.length === 0) return false;

    // ÉTAPE 2 — Construire le morceau "SET" de la requête.
    // `.map()` transforme chaque élément : 'telephone' → 'telephone = ?'
    // `.join(', ')` colle le tout avec des virgules.
    //   → setClause = 'telephone = ?'
    //   (avec 2 champs on aurait : 'nom = ?, telephone = ?')
    const setClause = fields.map((field) => `${field} = ?`).join(', ');

    // ÉTAPE 3 — Récupérer les valeurs dans le MÊME ordre que les colonnes.
    //   → values = ['0699999999']
    const values = fields.map((field) => data[field]);

    // ÉTAPE 4 — Assembler la requête finale :
    //   → 'UPDATE users SET telephone = ? WHERE id = ?'
    //
    // Est-ce dangereux d'insérer `setClause` avec ${} ?
    //   Non : les NOMS de colonnes viennent de NOTRE liste blanche, jamais de
    //   l'utilisateur. Les VALEURS, elles, passent toujours par des `?`.
    const sql = `UPDATE users SET ${setClause} WHERE id = ?`;

    // `[...values, id]` : les `...` ("spread") déplient le tableau `values`
    // puis on ajoute `id` à la fin, pour le dernier `?` (celui du WHERE).
    //   → ['0699999999', 7]
    const [result] = await pool.execute(sql, [...values, id]);

    // `affectedRows` = nombre de lignes concernées par le WHERE.
    // 0 → aucun utilisateur avec cet id.
    return result.affectedRows > 0;
  }


  // ===========================================================================
  //  7. CHANGER LE MOT DE PASSE  (utilisé par : profil client)
  // ===========================================================================
  //
  //  Reçoit : 7, '$2b$10$nouveauHash...'   ← DÉJÀ hashé par le controller
  //  Renvoie : true / false
  //
  //  Pourquoi une méthode à part et pas dans update() ?
  //    Pour qu'il soit IMPOSSIBLE de changer le mot de passe par le simple
  //    formulaire de profil. Changer de mot de passe exige une vérification
  //    supplémentaire (l'ancien mot de passe), faite dans le controller.
  //
  static async updatePassword(id, hash) {
    const [result] = await pool.execute(
      'UPDATE users SET mot_de_passe = ? WHERE id = ?',
      [hash, id]
    );
    return result.affectedRows > 0;
  }


  // ===========================================================================
  //  8. LISTER TOUS LES CLIENTS  (utilisé par : admin)
  // ===========================================================================
  //
  //  Renvoie : un tableau [ {id: 9, nom: ...}, {id: 7, nom: ...}, ... ]
  //
  //  `WHERE is_admin = FALSE` : l'espace admin gère les CLIENTS, on n'affiche
  //  donc pas les autres administrateurs dans la liste.
  //  `ORDER BY created_at DESC` : du plus récent au plus ancien
  //  (DESC = décroissant, ASC = croissant).
  //
  static async findAllClients() {
    const sql = `
      SELECT ${PUBLIC_FIELDS}
      FROM users
      WHERE is_admin = FALSE
      ORDER BY created_at DESC
    `;

    // Pas de `?` dans cette requête → pas besoin de tableau de valeurs.
    const [rows] = await pool.execute(sql);
    return rows;
  }


  // ===========================================================================
  //  9. RECHERCHER UN CLIENT  (utilisé par : admin)
  //     par nom, prénom, email OU numéro de compte (IBAN)
  // ===========================================================================
  //
  //  Reçoit : 'dup'
  //  Renvoie : tous les clients dont le nom, prénom, email ou un IBAN contient 'dup'
  //
  static async search(term) {

    // En SQL, `LIKE '%dup%'` veut dire "contient dup n'importe où".
    // Le `%` remplace "n'importe quels caractères (ou aucun)".
    // On fabrique cette chaîne en JavaScript, puis on la passe par un `?`
    // (et non directement dans la requête) → toujours protégé de l'injection.
    const like = `%${term}%`;

    // Explication de la requête :
    //
    // `FROM users u` : `u` est un ALIAS, un surnom court pour la table users.
    //
    // `LEFT JOIN comptes_bancaires c ON c.user_id = u.id`
    //   → on "colle" à chaque utilisateur ses comptes bancaires, pour pouvoir
    //     chercher dans la colonne `iban`.
    //   → LEFT JOIN (et pas JOIN tout court) : un client qui n'a AUCUN compte
    //     est quand même gardé. Avec un JOIN simple, il disparaîtrait des résultats.
    //
    // `SELECT DISTINCT` : si Marie a 3 comptes, la jointure produit 3 lignes
    //   "Marie". DISTINCT supprime les doublons → Marie n'apparaît qu'une fois.
    //
    // On écrit `u.id`, `u.nom`… (et pas juste `id`) parce que les DEUX tables
    //   ont une colonne `id` et une colonne `created_at` : il faut préciser
    //   laquelle on veut, sinon MySQL renvoie une erreur "ambiguous".
    //
    // Les parenthèses autour des OR sont importantes : sans elles,
    //   `is_admin = FALSE AND nom LIKE ? OR email LIKE ?` serait compris comme
    //   `(is_admin = FALSE AND nom LIKE ?) OR email LIKE ?` → des admins
    //   pourraient apparaître dans les résultats.
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

    // 4 `?` dans la requête → 4 valeurs (la même, répétée).
    const [rows] = await pool.execute(sql, [like, like, like, like]);
    return rows;
  }


  // ===========================================================================
  //  10. SUPPRIMER UN UTILISATEUR  (utilisé par : admin)
  // ===========================================================================
  //
  //  Reçoit : 7
  //  Renvoie : true si supprimé, false si l'id n'existait pas.
  //
  //  ⚠️ CONSÉQUENCES EN CASCADE (définies dans database.sql) :
  //    - Dans comptes_bancaires : `ON DELETE CASCADE`
  //        → TOUS les comptes de ce client sont supprimés automatiquement.
  //    - Dans transactions : `ON DELETE SET NULL`
  //        → les transactions restent (historique de la banque), mais leur
  //          référence vers le compte supprimé devient NULL.
  //  C'est irréversible : c'est pour ça que le cahier des charges exige une
  //  confirmation côté admin avant d'appeler cette méthode.
  //
  static async delete(id) {
    const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }


  // ===========================================================================
  //  11. COMPTER LES CLIENTS  (utilisé par : statistiques admin)
  // ===========================================================================
  //
  //  Renvoie : un nombre, par ex. 42
  //
  //  `COUNT(*)` compte les lignes. `AS total` donne un nom à cette colonne
  //  calculée, pour pouvoir la lire en JavaScript.
  //  MySQL renvoie donc : [ { total: 42 } ]
  //    → rows[0]       = { total: 42 }
  //    → rows[0].total = 42
  //
  static async countClients() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) AS total FROM users WHERE is_admin = FALSE'
    );
    return rows[0].total;
  }
}


// On exporte la classe pour que les autres fichiers puissent l'utiliser :
//     import UserModel from '../models/UserModel.js';
// `default` = c'est LA chose principale exportée par ce fichier.
export default UserModel;
