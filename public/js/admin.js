// admin.js : espace administrateur (statistiques, clients, comptes).
// Utilisé par admin.html. Les outils (sendJson, showMessage…) viennent de auth.js.
// Les données des clients sont affichées avec textContent : pas d'injection de HTML.

const $ = (id) => document.getElementById(id);

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const formatEuro = (n) => euros.format(Number(n) || 0);

const NOMS_COMPTES = { 'courant': 'Compte courant', 'livret A': 'Livret A', 'PEL': 'PEL' };

// Client affiché dans la fenêtre de détail (null si elle est fermée)
let clientOuvertId = null;

// ===================== OUTILS =====================

// Crée un élément : el('td', { textContent: 'Bonjour' })
function el(tag, props = {}, ...enfants) {
  const noeud = document.createElement(tag);
  Object.assign(noeud, props);
  noeud.append(...enfants);
  return noeud;
}

// Bouton d'action : une erreur s'affiche dans le message de la page.
function bouton(texte, classe, action) {
  const onclick = async () => {
    try {
      await action();
    } catch (erreur) {
      showMessage(erreur.message);
    }
  };
  return el('button', { type: 'button', className: `btn btn-sm ${classe}`, textContent: texte, onclick });
}

// GET JSON. Session expirée ou droits perdus : retour à la connexion.
async function getJson(url) {
  const res = await fetch(url);
  if (res.status === 401 || res.status === 403) {
    window.location.href = '/login.html';
    throw new Error('Accès refusé.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Erreur ${res.status}`);
  return data;
}

const ouvrir = (id) => $(id).classList.add('active');
const fermer = (id) => $(id).classList.remove('active');

function badgeStatut(statut) {
  const actif = statut === 'actif';
  return el('span', {
    className: `badge ${actif ? 'badge-actif' : 'badge-bloque'}`,
    textContent: actif ? 'Actif' : 'Bloqué'
  });
}

// ===================== STATISTIQUES =====================

async function chargerStats() {
  const stats = await getJson('/api/users/stats');
  $('stat-clients').textContent = stats.total_clients;
  $('stat-comptes').textContent = stats.total_comptes;
  $('stat-depots').textContent = formatEuro(stats.total_depots);
  $('stat-solde').textContent = formatEuro(stats.solde_total);
}

// ===================== CLIENTS =====================

async function chargerClients() {
  const q = $('recherche').value.trim();
  const clients = await getJson(`/api/users${q ? `?q=${encodeURIComponent(q)}` : ''}`);

  $('clients-body').replaceChildren(...clients.map((client) => el('tr', {},
    el('td', { textContent: `${client.prenom} ${client.nom}` }),
    el('td', { textContent: client.email }),
    el('td', { textContent: client.telephone || '—' }),
    el('td', {}, el('div', { className: 'actions' },
      bouton('Voir', 'btn-outline', () => ouvrirClient(client.id)),
      bouton('Modifier', 'btn-outline', () => ouvrirEdition(client)),
      bouton('Supprimer', 'btn-danger', () => ouvrirSuppression(client))
    ))
  )));

  $('clients-etat').textContent = clients.length
    ? `${clients.length} client${clients.length > 1 ? 's' : ''}`
    : 'Aucun client trouvé.';
}

// Détail d'un client et de ses comptes
async function ouvrirClient(id) {
  const { user, comptes } = await getJson(`/api/users/${id}`);
  clientOuvertId = id;

  $('client-titre').textContent = `${user.prenom} ${user.nom}`;

  const naissance = user.date_naissance ? user.date_naissance.split('-').reverse().join('/') : '—';
  const infos = [
    ['Email', user.email],
    ['Téléphone', user.telephone || '—'],
    ['Adresse', user.adresse_postale || '—'],
    ['Date de naissance', naissance]
  ];
  $('client-infos').replaceChildren(...infos.map(([cle, valeur]) => el('div', { className: 'detail-row' },
    el('span', { className: 'detail-key', textContent: cle }),
    el('span', { className: 'detail-val', textContent: valeur })
  )));

  $('client-comptes').replaceChildren(...comptes.map((compte) => el('tr', {},
    el('td', { textContent: compte.iban }),
    el('td', { textContent: NOMS_COMPTES[compte.type_compte] || compte.type_compte }),
    el('td', { className: 'num', textContent: formatEuro(compte.solde) }),
    el('td', {}, badgeStatut(compte.statut)),
    el('td', {}, actionsCompte(compte))
  )));
  $('client-comptes-etat').textContent = comptes.length ? '' : 'Aucun compte.';

  ouvrir('modal-client');
}

function effacerErreursEdition() {
  const form = $('edition-form');
  form.querySelectorAll('.error').forEach((e) => (e.textContent = ''));
  form.querySelectorAll('[aria-invalid]').forEach((e) => e.removeAttribute('aria-invalid'));
}

function ouvrirEdition(client) {
  const form = $('edition-form');
  effacerErreursEdition();
  ['prenom', 'nom', 'email', 'telephone', 'date_naissance', 'adresse_postale'].forEach((champ) => {
    form[champ].value = client[champ] ?? '';
  });
  form.dataset.id = client.id;
  ouvrir('modal-edition');
}

// PUT /api/users/:id
async function enregistrerClient(event) {
  event.preventDefault();
  const form = event.target;
  effacerErreursEdition();

  const valeurs = Object.fromEntries(new FormData(form));
  Object.keys(valeurs).forEach((k) => (valeurs[k] = valeurs[k].trim()));

  try {
    const { ok, data } = await sendJson('PUT', `/api/users/${form.dataset.id}`, valeurs);
    if (!ok) {
      (data.erreurs || []).forEach((e) => showFieldError(e.champ, e.message));
      // Sans détail par champ, c'est un email déjà pris (409)
      if (!data.erreurs) showFieldError('email', data.message || 'Une erreur est survenue.');
      return;
    }

    fermer('modal-edition');
    showMessage('Client modifié.', 'success');
    await Promise.all([chargerClients(), chargerComptes()]);
  } catch (erreur) {
    fermer('modal-edition');
    showMessage('Impossible de contacter le serveur.');
  }
}

function ouvrirSuppression(client) {
  $('suppression-texte').textContent = `Supprimer définitivement ${client.prenom} ${client.nom} (${client.email}) ?`;
  $('btn-supprimer').onclick = () => supprimerClient(client.id).catch((erreur) => showMessage(erreur.message));
  ouvrir('modal-suppression');
}

// DELETE /api/users/:id (le serveur exige la confirmation)
async function supprimerClient(id) {
  const { ok, data } = await sendJson('DELETE', `/api/users/${id}`, { confirmation: true });
  fermer('modal-suppression');

  if (!ok) return showMessage(data.message || 'Suppression impossible.');

  showMessage('Client supprimé.', 'success');
  await Promise.all([chargerStats(), chargerClients(), chargerComptes()]);
}

// ===================== COMPTES =====================

// Boutons communs à la liste des comptes et au détail d'un client
function actionsCompte(compte) {
  const bloque = compte.statut !== 'actif';
  return el('div', { className: 'actions' },
    bouton(bloque ? 'Débloquer' : 'Bloquer', bloque ? 'btn-outline' : 'btn-danger',
      () => changerStatut(compte.id, bloque ? 'actif' : 'bloqué')),
    bouton('Historique', 'btn-outline', () => ouvrirHistorique(compte))
  );
}

async function chargerComptes() {
  const comptes = await getJson('/api/comptes/tous');

  $('comptes-body').replaceChildren(...comptes.map((compte) => el('tr', {},
    el('td', { textContent: compte.iban }),
    el('td', { textContent: `${compte.prenom} ${compte.nom}` }),
    el('td', { textContent: NOMS_COMPTES[compte.type_compte] || compte.type_compte }),
    el('td', { className: 'num', textContent: formatEuro(compte.solde) }),
    el('td', {}, badgeStatut(compte.statut)),
    el('td', {}, actionsCompte(compte))
  )));

  $('comptes-etat').textContent = comptes.length
    ? `${comptes.length} compte${comptes.length > 1 ? 's' : ''}`
    : 'Aucun compte.';
}

// PATCH /api/comptes/:id/statut
async function changerStatut(id, statut) {
  const { ok, data } = await sendJson('PATCH', `/api/comptes/${id}/statut`, { statut });
  if (!ok) return showMessage(data.message || 'Modification impossible.');

  showMessage(data.message, 'success');
  await chargerComptes();
  if (clientOuvertId) await ouvrirClient(clientOuvertId);
}

// Historique d'un compte (une ligne de virement est reçue ou émise selon le côté)
async function ouvrirHistorique(compte) {
  const lignes = await getJson(`/api/transactions/historique/${compte.id}`);

  $('historique-titre').textContent = `Historique · ${compte.iban}`;
  $('historique-body').replaceChildren(...lignes.map((t) => {
    const recu = t.compte_destinataire_id === compte.id;
    const libelles = { depot: 'Dépôt', retrait: 'Retrait' };
    const operation = libelles[t.type_transaction] || (recu ? 'Virement reçu' : 'Virement émis');

    return el('tr', {},
      el('td', { textContent: new Date(t.date_transaction).toLocaleString('fr-FR') }),
      el('td', { textContent: operation }),
      el('td', { textContent: t.description || '—' }),
      el('td', {
        className: `num ${recu ? 'credit' : 'debit'}`,
        textContent: `${recu ? '+' : '−'} ${formatEuro(t.montant)}`
      })
    );
  }));

  $('historique-etat').textContent = lignes.length ? '' : 'Aucune opération.';
  ouvrir('modal-historique');
}

// ===================== DÉMARRAGE =====================

function choisirOnglet(nom) {
  document.querySelectorAll('[data-onglet]').forEach((onglet) => {
    const actif = onglet.dataset.onglet === nom;
    onglet.className = `btn btn-sm ${actif ? 'btn-primary' : 'btn-outline'}`;
    onglet.setAttribute('aria-selected', String(actif));
    $(`onglet-${onglet.dataset.onglet}`).hidden = !actif;
  });
}

function fermerFenetre(overlay) {
  overlay.classList.remove('active');
  if (overlay.id === 'modal-client') clientOuvertId = null;
}

document.addEventListener('DOMContentLoaded', async () => {
  document.querySelectorAll('[data-onglet]').forEach((onglet) =>
    onglet.addEventListener('click', () => choisirOnglet(onglet.dataset.onglet)));

  $('recherche-form').addEventListener('submit', (e) => {
    e.preventDefault();
    chargerClients().catch((erreur) => showMessage(erreur.message));
  });
  $('edition-form').addEventListener('submit', enregistrerClient);

  // Fermeture des fenêtres : croix, Annuler, ou clic à côté
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) fermerFenetre(overlay);
    });
    overlay.querySelectorAll('.modal-close, .modal-cancel').forEach((b) =>
      b.addEventListener('click', () => fermerFenetre(overlay)));
  });

  try {
    const { user } = await getJson('/api/auth/me');
    $('user-name').textContent = `${user.prenom} ${user.nom}`;
    await Promise.all([chargerStats(), chargerClients(), chargerComptes()]);
  } catch (erreur) {
    showMessage(erreur.message);
  }
});
