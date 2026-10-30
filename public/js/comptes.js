/**
 * ==============================================================================
 * KampusBank - Module Comptes Bancaires (comptes.js)
 * Développeur B : Gestion complète des comptes (Création, IBAN, Clôture, Statuts)
 * ==============================================================================
 */

// État local du module
const state = {
  comptes: [],
  currentUser: null,
  compteActifPourAction: null
};

// Cache du jeton CSRF pour les requêtes POST, DELETE, PATCH
let csrfTokenCache = null;

/**
 * Récupère le jeton CSRF fourni par l'API (GET /api/auth/csrf-token)
 * et le met en cache pour les requêtes mutatives (POST, DELETE, PATCH).
 */
async function obtenirCsrfToken(forceRefresh = false) {
  if (csrfTokenCache && !forceRefresh) return csrfTokenCache;
  try {
    const res = await fetch('/api/auth/csrf-token');
    if (res.ok) {
      const data = await res.json();
      csrfTokenCache = data.csrfToken;
      return csrfTokenCache;
    }
  } catch (err) {
    console.warn('Impossible de récupérer le jeton CSRF :', err);
  }
  return '';
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  initialiserModuleComptes();
});

/**
 * Initialise les écouteurs d'événements et lance le chargement des données
 */
async function initialiserModuleComptes() {
  configurerEcouteursModales();
  configurerSelecteurTypeCompte();
  await Promise.all([
    chargerUtilisateur(),
    chargerComptes(),
    obtenirCsrfToken()
  ]);
}

/**
 * Charge les informations de l'utilisateur connecté via /api/auth/me
 */
async function chargerUtilisateur() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      state.currentUser = data.user || data;
      mettreAJourProfilUI(state.currentUser);
    } else {
      // Non connecté : invitation ou informations par défaut
      mettreAJourProfilUI(null);
    }
  } catch (err) {
    console.warn('Impossible de charger le profil (session expirée ou hors ligne) :', err);
    mettreAJourProfilUI(null);
  }
}

/**
 * Met à jour l'affichage de l'en-tête utilisateur dans la barre de navigation
 */
function mettreAJourProfilUI(user) {
  const userNameEl = document.getElementById('navbar-user-name');
  const userAvatarEl = document.getElementById('navbar-user-avatar');
  const userRoleEl = document.getElementById('navbar-user-role');
  const adminBadgeEl = document.getElementById('navbar-admin-badge');

  if (user) {
    const prenom = user.prenom || 'Client';
    const nom = user.nom || '';
    if (userNameEl) userNameEl.textContent = `${prenom} ${nom}`.trim();
    if (userAvatarEl) userAvatarEl.textContent = (prenom.charAt(0) + (nom ? nom.charAt(0) : '')).toUpperCase();
    if (userRoleEl) userRoleEl.textContent = user.is_admin ? 'Administrateur' : 'Client Particulier';
    if (adminBadgeEl) adminBadgeEl.style.display = user.is_admin ? 'inline-flex' : 'none';
  } else {
    if (userNameEl) userNameEl.textContent = 'Espace Démo';
    if (userAvatarEl) userAvatarEl.textContent = 'KB';
    if (userRoleEl) userRoleEl.textContent = 'Client';
    if (adminBadgeEl) adminBadgeEl.style.display = 'none';
  }
}

/**
 * Récupère la liste des comptes de l'utilisateur connecté (GET /api/comptes)
 */
async function chargerComptes() {
  const container = document.getElementById('accounts-grid');
  if (!container) return;

  try {
    const res = await fetch('/api/comptes');
    if (res.status === 401) {
      afficherAlerteNonConnecte();
      return;
    }
    if (!res.ok) {
      throw new Error(`Erreur ${res.status}: Impossible de récupérer les comptes.`);
    }

    const data = await res.json();
    state.comptes = Array.isArray(data) ? data : [];
    rendreComptes();
    mettreAJourBandeauSynthese();
  } catch (err) {
    console.error('Erreur lors du chargement des comptes :', err);
    container.innerHTML = `
      <div class="empty-accounts">
        <div class="empty-icon">⚠️</div>
        <h3 class="empty-title">Erreur de chargement</h3>
        <p class="empty-text">${err.message}</p>
        <button class="btn btn-secondary btn-sm" onclick="chargerComptes()">Réessayer</button>
      </div>
    `;
  }
}

/**
 * Affiche un message invitant à se connecter si la requête retourne 401
 */
function afficherAlerteNonConnecte() {
  const container = document.getElementById('accounts-grid');
  if (!container) return;

  container.innerHTML = `
    <div class="empty-accounts">
      <div class="empty-icon" style="background: rgba(245, 158, 11, 0.15); color: var(--warning);">🔒</div>
      <h3 class="empty-title">Authentification requise</h3>
      <p class="empty-text">Veuillez vous connecter pour accéder à vos comptes bancaires et effectuer des opérations.</p>
      <div style="display: flex; gap: 12px; margin-top: 8px;">
        <a href="/login.html" class="btn btn-primary btn-sm">Se connecter</a>
        <a href="/register.html" class="btn btn-secondary btn-sm">Ouvrir un compte</a>
      </div>
    </div>
  `;
}

/**
 * Rendu visuel de la liste des comptes bancaires
 */
function rendreComptes() {
  const container = document.getElementById('accounts-grid');
  if (!container) return;

  if (state.comptes.length === 0) {
    container.innerHTML = `
      <div class="empty-accounts">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="5" width="20" height="14" rx="2"></rect>
            <line x1="2" y1="10" x2="22" y2="10"></line>
          </svg>
        </div>
        <h3 class="empty-title">Aucun compte bancaire</h3>
        <p class="empty-text">Vous ne possédez aucun compte ouvert pour le moment. Ouvrez votre premier compte en quelques secondes !</p>
        <button class="btn btn-primary" onclick="ouvrirModalNouveauCompte()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Ouvrir un compte
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = state.comptes.map(compte => {
    const typeNormalise = (compte.type_compte || 'courant').toLowerCase().replace(' ', '');
    const soldeNumerique = parseFloat(compte.solde) || 0;
    const estBloque = compte.statut === 'bloqué';
    const dateCreation = compte.created_at ? formaterDate(compte.created_at) : 'Récemment';

    return `
      <div class="bank-card type-${typeNormalise} ${estBloque ? 'is-blocked' : ''}" id="compte-card-${compte.id}">
        <!-- En-tête de la carte -->
        <div class="card-top">
          <div class="card-type-info">
            <span class="card-type-name">${formaterNomType(compte.type_compte)}</span>
            <span class="card-created-at">Ouvert le ${dateCreation}</span>
          </div>
          <div class="card-status-badge">
            <span class="badge ${estBloque ? 'badge-bloque' : 'badge-actif'}">
              <span class="badge-dot"></span>
              ${estBloque ? 'Bloqué' : 'Actif'}
            </span>
          </div>
        </div>

        <!-- Puce EMV & Logo sans contact -->
        <div class="card-chip-row">
          <div class="card-chip"></div>
          <svg class="contactless-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8.5 16.5a5 5 0 0 1 0-7"></path>
            <path d="M12 19a9 9 0 0 0 0-14"></path>
          </svg>
        </div>

        <!-- Solde du compte -->
        <div class="card-balance-block">
          <div class="card-balance-label">Solde disponible</div>
          <div class="card-balance-amount">${formaterDevise(soldeNumerique)}</div>
        </div>

        <!-- IBAN du compte avec copie rapide -->
        <div class="card-iban-block">
          <span class="card-iban-number">${formaterIban(compte.iban)}</span>
          <button class="btn-copy-iban" onclick="copierIban('${compte.iban}')" title="Copier l'IBAN complet">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copier</span>
          </button>
        </div>

        <!-- Actions de la carte -->
        <div class="card-actions">
          <div class="card-actions-left">
            <button class="btn btn-outline btn-sm" onclick="ouvrirModalDetail(${compte.id})">
              Détails
            </button>
            <a href="/transactions.html" class="btn btn-outline btn-sm" title="Effectuer un virement, dépôt ou retrait">
              Opérations
            </a>
            ${state.currentUser && state.currentUser.is_admin ? `
              <button class="btn btn-outline btn-sm" onclick="ouvrirModalStatut(${compte.id})" title="Changer le statut (Admin)">
                ${estBloque ? 'Débloquer' : 'Bloquer'}
              </button>
            ` : ''}
          </div>
          <button class="btn btn-danger btn-sm" onclick="preparerClotureCompte(${compte.id})">
            Clôturer
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Met à jour le bandeau de synthèse financière (solde total, comptes actifs)
 */
function mettreAJourBandeauSynthese() {
  const totalSoldeEl = document.getElementById('summary-total-solde');
  const totalComptesEl = document.getElementById('summary-total-comptes');
  const countBadgeEl = document.getElementById('comptes-count-badge');

  const total = state.comptes.reduce((acc, c) => acc + (parseFloat(c.solde) || 0), 0);
  const actifs = state.comptes.filter(c => c.statut === 'actif').length;

  if (totalSoldeEl) totalSoldeEl.textContent = formaterDevise(total);
  if (totalComptesEl) totalComptesEl.textContent = `${state.comptes.length} compte${state.comptes.length > 1 ? 's' : ''} (${actifs} actif${actifs > 1 ? 's' : ''})`;
  if (countBadgeEl) countBadgeEl.textContent = state.comptes.length;
}

/**
 * Création d'un nouveau compte bancaire (POST /api/comptes)
 */
async function creerCompte() {
  const selectedOption = document.querySelector('.account-type-option.selected');
  const typeCompte = selectedOption ? selectedOption.dataset.type : 'courant';
  const submitBtn = document.getElementById('btn-submit-nouveau-compte');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Création en cours...';
  }

  try {
    const csrfToken = await obtenirCsrfToken();
    const headers = { 'Content-Type': 'application/json' };
    if (csrfToken) headers['x-csrf-token'] = csrfToken;

    const res = await fetch('/api/comptes', {
      method: 'POST',
      headers,
      body: JSON.stringify({ type_compte: typeCompte })
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 403) csrfTokenCache = null;
      throw new Error(data.message || 'Impossible de créer le compte.');
    }

    fermerModalNouveauCompte();
    afficherToast(`Compte ${formaterNomType(typeCompte)} créé avec succès ! IBAN : ${formaterIban(data.iban)}`, 'success');
    await chargerComptes();
  } catch (err) {
    afficherToast(err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Créer mon compte';
    }
  }
}

/**
 * Ouvre la modale de clôture et vérifie la règle de gestion solde = 0€
 */
function preparerClotureCompte(compteId) {
  const compte = state.comptes.find(c => c.id === compteId);
  if (!compte) return;

  state.compteActifPourAction = compte;
  const solde = parseFloat(compte.solde) || 0;
  const modal = document.getElementById('modal-cloture-compte');
  const alertContainer = document.getElementById('cloture-alert-container');
  const btnConfirmer = document.getElementById('btn-confirmer-cloture');
  const ibanEl = document.getElementById('cloture-iban');
  const typeEl = document.getElementById('cloture-type');
  const soldeEl = document.getElementById('cloture-solde');

  if (ibanEl) ibanEl.textContent = formaterIban(compte.iban);
  if (typeEl) typeEl.textContent = formaterNomType(compte.type_compte);
  if (soldeEl) soldeEl.textContent = formaterDevise(solde);

  // Règle de gestion RG 4.2 : suppression uniquement si solde = 0€
  if (solde !== 0) {
    alertContainer.innerHTML = `
      <div class="closure-alert alert-danger">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <div>
          <strong>Clôture impossible : solde non nul (${formaterDevise(solde)})</strong><br>
          Conformément au règlement bancaire, un compte ne peut être clôturé que si son solde est strictement égal à 0,00 €. Veuillez d'abord transférer ou retirer l'intégralité des fonds.
        </div>
      </div>
    `;
    if (btnConfirmer) btnConfirmer.disabled = true;
  } else {
    alertContainer.innerHTML = `
      <div class="closure-alert alert-warning">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;">
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <div>
          <strong>Confirmation requise</strong><br>
          Le solde est bien de 0,00 €. Cette action est irréversible. L'IBAN associé ne sera plus utilisable.
        </div>
      </div>
    `;
    if (btnConfirmer) btnConfirmer.disabled = false;
  }

  ouvrirModal(modal);
}

/**
 * Exécute la suppression définitive du compte (DELETE /api/comptes/:id)
 */
async function confirmerClotureCompte() {
  if (!state.compteActifPourAction) return;

  const compteId = state.compteActifPourAction.id;
  const btnConfirmer = document.getElementById('btn-confirmer-cloture');

  if (btnConfirmer) {
    btnConfirmer.disabled = true;
    btnConfirmer.textContent = 'Clôture en cours...';
  }

  try {
    const csrfToken = await obtenirCsrfToken();
    const headers = {};
    if (csrfToken) headers['x-csrf-token'] = csrfToken;

    const res = await fetch(`/api/comptes/${compteId}`, {
      method: 'DELETE',
      headers
    });
    const data = await res.json();

    if (!res.ok) {
      if (res.status === 403) csrfTokenCache = null;
      throw new Error(data.message || 'Erreur lors de la clôture.');
    }

    fermerModal(document.getElementById('modal-cloture-compte'));
    afficherToast('Le compte bancaire a été clôturé avec succès.', 'success');
    await chargerComptes();
  } catch (err) {
    afficherToast(err.message, 'error');
  } finally {
    if (btnConfirmer) {
      btnConfirmer.disabled = false;
      btnConfirmer.textContent = 'Confirmer la clôture';
    }
  }
}

/**
 * Ouvre la modale de détail d'un compte (GET /api/comptes/:id)
 */
async function ouvrirModalDetail(compteId) {
  const modal = document.getElementById('modal-detail-compte');
  const body = document.getElementById('detail-compte-body');
  if (!modal || !body) return;

  body.innerHTML = '<div style="text-align: center; padding: 20px;">Chargement des informations...</div>';
  ouvrirModal(modal);

  try {
    const res = await fetch(`/api/comptes/${compteId}`);
    if (!res.ok) throw new Error('Impossible de charger les détails du compte.');
    const compte = await res.json();

    body.innerHTML = `
      <div class="detail-row">
        <span class="detail-key">Type de compte</span>
        <span class="detail-val">${formaterNomType(compte.type_compte)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Statut</span>
        <span class="detail-val">
          <span class="badge ${compte.statut === 'actif' ? 'badge-actif' : 'badge-bloque'}">
            <span class="badge-dot"></span> ${compte.statut}
          </span>
        </span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Solde actuel</span>
        <span class="detail-val" style="font-size: 1.15rem; color: var(--success);">${formaterDevise(parseFloat(compte.solde) || 0)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Numéro IBAN</span>
        <span class="detail-val iban">${formaterIban(compte.iban)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Date d'ouverture</span>
        <span class="detail-val">${compte.created_at ? formaterDate(compte.created_at) : 'N/A'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-key">Identifiant compte</span>
        <span class="detail-val">#${compte.id}</span>
      </div>
      <div style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 8px;">
        <button class="btn btn-outline btn-sm" onclick="copierIban('${compte.iban}')">
          📋 Copier l'IBAN
        </button>
      </div>
    `;
  } catch (err) {
    body.innerHTML = `<div style="color: var(--danger); text-align: center;">${err.message}</div>`;
  }
}

/**
 * Ouvre la modale pour bloquer/débloquer un compte (Admin)
 */
function ouvrirModalStatut(compteId) {
  const compte = state.comptes.find(c => c.id === compteId);
  if (!compte) return;

  state.compteActifPourAction = compte;
  const modal = document.getElementById('modal-statut-compte');
  const nouveauStatut = compte.statut === 'actif' ? 'bloqué' : 'actif';
  
  const textEl = document.getElementById('statut-modal-text');
  const btnEl = document.getElementById('btn-confirmer-statut');

  if (textEl) {
    textEl.innerHTML = `Voulez-vous modifier le statut du compte <strong>${formaterIban(compte.iban)}</strong> vers <strong>${nouveauStatut.toUpperCase()}</strong> ?`;
  }

  if (btnEl) {
    btnEl.textContent = nouveauStatut === 'bloqué' ? 'Bloquer le compte' : 'Débloquer le compte';
    btnEl.className = nouveauStatut === 'bloqué' ? 'btn btn-danger' : 'btn btn-primary';
    btnEl.onclick = () => modifierStatutCompte(compteId, nouveauStatut);
  }

  ouvrirModal(modal);
}

/**
 * Exécute la modification de statut (PATCH /api/comptes/:id/statut)
 */
async function modifierStatutCompte(compteId, statut) {
  const btn = document.getElementById('btn-confirmer-statut');
  if (btn) btn.disabled = true;

  try {
    const csrfToken = await obtenirCsrfToken();
    const headers = { 'Content-Type': 'application/json' };
    if (csrfToken) headers['x-csrf-token'] = csrfToken;

    const res = await fetch(`/api/comptes/${compteId}/statut`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ statut })
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 403) csrfTokenCache = null;
      throw new Error(data.message || 'Erreur lors de la modification de statut.');
    }

    fermerModal(document.getElementById('modal-statut-compte'));
    afficherToast(`Le compte est désormais ${statut}.`, 'success');
    await chargerComptes();
  } catch (err) {
    afficherToast(err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/**
 * Sélecteur d'options visuel dans la modale de création
 */
function configurerSelecteurTypeCompte() {
  const options = document.querySelectorAll('.account-type-option');
  options.forEach(opt => {
    opt.addEventListener('click', () => {
      options.forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });
}

/**
 * Configuration des fermetures de modales
 */
function configurerEcouteursModales() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        fermerModal(overlay);
      }
    });
  });

  document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) fermerModal(modal);
    });
  });
}

function ouvrirModal(modal) {
  if (modal) modal.classList.add('active');
}

function fermerModal(modal) {
  if (modal) modal.classList.remove('active');
}

function ouvrirModalNouveauCompte() {
  ouvrirModal(document.getElementById('modal-nouveau-compte'));
}

function fermerModalNouveauCompte() {
  fermerModal(document.getElementById('modal-nouveau-compte'));
}

/**
 * Copie de l'IBAN dans le presse-papier
 */
async function copierIban(iban) {
  try {
    await navigator.clipboard.writeText(iban);
    afficherToast('IBAN copié dans le presse-papier !', 'info');
  } catch (err) {
    afficherToast('Échec de la copie : ' + iban, 'error');
  }
}

/**
 * Système de notifications Toasts
 */
function afficherToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';

  toast.innerHTML = `<span>${icon}</span><span style="flex-grow:1;">${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/**
 * Fonctions de formattage
 */
function formaterDevise(montant) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(montant);
}

function formaterIban(iban) {
  if (!iban) return '';
  return iban.replace(/(.{4})/g, '$1 ').trim();
}

function formaterNomType(type) {
  if (!type) return 'Compte Courant';
  if (type.toLowerCase() === 'livret a') return 'Livret A';
  if (type.toLowerCase() === 'pel') return 'Plan Épargne Logement (PEL)';
  return 'Compte Courant';
}

function formaterDate(dateString) {
  const d = new Date(dateString);
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}
