// transactions.js : page Transactions (dépôt, retrait, virement, historique).
// Utilisé par transactions.html.
// Tout est enfermé dans une IIFE (fonction exécutée immédiatement) : aucune variable globale,
// donc pas de conflit avec comptes.js ou auth.js si un jour ils sont chargés sur la même page.

(() => {
  'use strict';

  // ===================== ÉTAT DE LA PAGE =====================

  const state = {
    comptes: [],          // comptes de l'utilisateur (GET /api/comptes)
    compteId: null,       // compte sélectionné
    operation: 'depot',   // onglet actif : 'depot' | 'retrait' | 'virement'
    csrf: null            // jeton CSRF en cache
  };

  // URL et messages de chaque opération
  const OPERATIONS = {
    depot:    { bouton: 'Déposer',             url: '/api/transactions/deposer',  succes: 'Dépôt effectué.' },
    retrait:  { bouton: 'Retirer',             url: '/api/transactions/retirer',  succes: 'Retrait effectué.' },
    virement: { bouton: 'Envoyer le virement', url: '/api/transactions/virement', succes: 'Virement effectué.' }
  };

  const NOMS_COMPTES = { 'courant': 'Compte courant', 'livret a': 'Livret A', 'pel': 'PEL' };

  const $ = (id) => document.getElementById(id);

  // ===================== FORMATAGE =====================

  const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const formatEuro = (n) => euros.format(Number(n) || 0);

  const formatDate = (s) => new Date(s).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const nomCompte = (c) => NOMS_COMPTES[(c.type_compte || '').toLowerCase()] || c.type_compte;

  // Date du jour au format AAAA-MM-JJ (heure locale)
  function dateDuJour() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  // "12,5" ou "12.50" → 12.5 ; null si invalide (nombre > 0, 2 décimales max)
  function lireMontant(texte) {
    const t = texte.trim().replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
    const n = Number(t);
    return n > 0 ? n : null;
  }

  // ===================== APPELS API =====================

  // Jeton CSRF (obligatoire pour les POST). Lié au cookie de session.
  async function getCsrf(forcer = false) {
    if (state.csrf && !forcer) return state.csrf;
    const res = await fetch('/api/auth/csrf-token');
    state.csrf = (await res.json()).csrfToken;
    return state.csrf;
  }

  // GET JSON. Redirige vers la connexion si la session a expiré.
  async function getJson(url) {
    const res = await fetch(url);
    if (res.status === 401) {
      window.location.href = '/login.html';
      throw new Error('Session expirée.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || `Erreur ${res.status}`);
    return data;
  }

  // POST JSON avec jeton CSRF. Renvoie { ok, status, data }.
  async function postJson(url, body, reessayer = true) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': await getCsrf() },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      window.location.href = '/login.html';
    }
    // Jeton CSRF périmé (ex : reconnexion dans un autre onglet) : on en redemande un, une seule fois.
    if (res.status === 403 && reessayer && /csrf/i.test(data.message || '')) {
      await getCsrf(true);
      return postJson(url, body, false);
    }
    return { ok: res.ok, status: res.status, data };
  }

  // ===================== MESSAGES & ERREURS =====================

  let timerMessage;
  function showMessage(texte, type = 'error') {
    const el = $('tx-message');
    el.textContent = texte; // textContent : jamais de HTML injecté
    el.className = `message ${type}-msg`;
    el.hidden = false;
    clearTimeout(timerMessage);
    timerMessage = setTimeout(() => (el.hidden = true), 6000);
  }

  function erreurChamp(champ, texte) {
    const el = document.querySelector(`[data-error-for="${champ}"]`);
    if (el) el.textContent = texte;
    $(champ)?.setAttribute('aria-invalid', 'true');
  }

  function effacerErreurs() {
    const form = $('operation-form');
    form.querySelectorAll('.error').forEach((el) => (el.textContent = ''));
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  }

  // ===================== COMPTES =====================

  const compteCourant = () => state.comptes.find((c) => c.id === state.compteId);

  async function chargerComptes() {
    state.comptes = await getJson('/api/comptes');

    // Aucun compte : on affiche l'invitation à en ouvrir un
    const aucun = state.comptes.length === 0;
    $('aucun-compte').hidden = !aucun;
    $('tx-contenu').hidden = aucun;
    if (aucun) return;

    // Liste déroulante des comptes
    const select = $('compte-select');
    select.replaceChildren(...state.comptes.map((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${nomCompte(c)} · ${c.iban}`;
      return opt;
    }));

    // Compte à sélectionner : celui déjà choisi, sinon ?compte=ID dans l'URL, sinon le premier
    const depuisUrl = Number(new URLSearchParams(window.location.search).get('compte'));
    const choix = [state.compteId, depuisUrl].find((id) => state.comptes.some((c) => c.id === id));
    state.compteId = choix ?? state.comptes[0].id;
    select.value = String(state.compteId);

    afficherCompte();
  }

  // Met à jour solde, statut, liste des IBAN internes et bouton d'opération
  function afficherCompte() {
    const c = compteCourant();
    if (!c) return;

    const bloque = c.statut !== 'actif';
    $('compte-solde').textContent = formatEuro(c.solde);
    $('compte-statut').textContent = bloque ? 'Bloqué' : 'Actif';
    $('compte-statut').className = `badge ${bloque ? 'badge-bloque' : 'badge-actif'}`;
    $('compte-bloque-alerte').hidden = !bloque;
    $('btn-operation').disabled = bloque;

    // Suggestions de virement : mes autres comptes actifs
    $('ibans-internes').replaceChildren(...state.comptes
      .filter((autre) => autre.id !== c.id && autre.statut === 'actif')
      .map((autre) => {
        const opt = document.createElement('option');
        opt.value = autre.iban;
        opt.label = `${nomCompte(autre)} (${formatEuro(autre.solde)})`;
        return opt;
      }));
  }

  function changerCompte() {
    state.compteId = Number($('compte-select').value);
    // Garde le compte dans l'URL (lien partageable, conservé au rechargement)
    window.history.replaceState(null, '', `?compte=${state.compteId}`);
    effacerErreurs();
    afficherCompte();
    chargerHistorique();
  }

  // ===================== OPÉRATIONS =====================

  function choisirOperation(op) {
    state.operation = op;
    document.querySelectorAll('[data-operation]').forEach((onglet) => {
      const actif = onglet.dataset.operation === op;
      onglet.classList.toggle('active', actif);
      onglet.setAttribute('aria-selected', String(actif));
    });
    $('champ-iban').hidden = op !== 'virement';
    $('btn-operation').textContent = OPERATIONS[op].bouton;
    effacerErreurs();
  }

  async function soumettreOperation(event) {
    event.preventDefault();
    effacerErreurs();

    const c = compteCourant();
    if (!c) return;

    const op = state.operation;
    const montant = lireMontant($('montant').value);
    const description = $('description').value.trim() || undefined; // undefined : libellé par défaut côté serveur
    let destIban;
    let valide = true;

    // Vérifications côté navigateur (le serveur revérifie tout)
    if (montant === null) {
      erreurChamp('montant', 'Montant invalide (ex : 25 ou 25,50).');
      valide = false;
    } else if (op !== 'depot' && montant > Number(c.solde)) {
      erreurChamp('montant', `Solde insuffisant : ${formatEuro(c.solde)} disponibles.`);
      valide = false;
    }

    if (op === 'virement') {
      destIban = $('dest_iban').value.trim().toUpperCase();
      if (!destIban) {
        erreurChamp('dest_iban', "L'IBAN du bénéficiaire est obligatoire.");
        valide = false;
      } else if (destIban === c.iban) {
        erreurChamp('dest_iban', 'Impossible de virer vers le même compte.');
        valide = false;
      }
    }
    if (!valide) return;

    // Confirmation avant un virement (opération sensible)
    if (op === 'virement' && !window.confirm(`Confirmer le virement de ${formatEuro(montant)} vers ${destIban} ?`)) {
      return;
    }

    const body = op === 'virement'
      ? { compte_source_id: c.id, dest_iban: destIban, montant, description }
      : { compte_id: c.id, montant, description };

    const bouton = $('btn-operation');
    bouton.disabled = true;

    try {
      const { ok, data } = await postJson(OPERATIONS[op].url, body);
      if (!ok) {
        showMessage(data.error || data.message || 'Opération refusée.');
        return;
      }
      showMessage(OPERATIONS[op].succes, 'success');
      $('operation-form').reset();
      // Nouveau solde + nouvelle ligne dans l'historique
      await Promise.all([chargerComptes(), chargerHistorique()]);
    } catch (erreur) {
      showMessage('Impossible de contacter le serveur.');
    } finally {
      afficherCompte(); // réactive le bouton (sauf si le compte est bloqué)
    }
  }

  // ===================== HISTORIQUE =====================

  // Sens d'une transaction vu depuis le compte affiché
  function decrireTransaction(t, compteId) {
    if (t.type_transaction === 'depot') return { libelle: 'Dépôt', credit: true };
    if (t.type_transaction === 'retrait') return { libelle: 'Retrait', credit: false };
    // Virement : une seule ligne en base, reçue ou émise selon le côté où l'on se trouve
    return t.compte_destinataire_id === compteId
      ? { libelle: 'Virement reçu', credit: true, contrepartie: t.iban_source && `De ${t.iban_source}` }
      : { libelle: 'Virement émis', credit: false, contrepartie: t.iban_destinataire && `Vers ${t.iban_destinataire}` };
  }

  async function chargerHistorique() {
    const c = compteCourant();
    if (!c) return;

    const debut = $('filtre-debut').value;
    const fin = $('filtre-fin').value;
    if (debut && fin && debut > fin) {
      $('historique-etat').textContent = 'La date de début doit précéder la date de fin.';
      return;
    }

    // Le serveur filtre les dates seulement si les deux bornes sont fournies
    const params = new URLSearchParams();
    const type = $('filtre-type').value;
    if (type) params.set('type', type);
    if (debut || fin) {
      params.set('dateDebut', `${debut || '1970-01-01'} 00:00:00`);
      params.set('dateFin', `${fin || dateDuJour()} 23:59:59`); // inclut toute la journée de fin
    }

    $('historique-etat').textContent = 'Chargement…';
    try {
      const lignes = await getJson(`/api/transactions/historique/${c.id}?${params}`);
      afficherHistorique(lignes, c.id);
    } catch (erreur) {
      $('historique-body').replaceChildren();
      $('historique-etat').textContent = erreur.message;
    }
  }

  function afficherHistorique(lignes, compteId) {
    const tbody = $('historique-body');
    let creditsCentimes = 0;
    let debitsCentimes = 0;

    // Construction avec createElement/textContent : les libellés saisis par les
    // utilisateurs ne peuvent pas injecter de HTML (protection XSS).
    const rangees = lignes.map((t) => {
      const info = decrireTransaction(t, compteId);
      const centimes = Math.round(Number(t.montant) * 100); // calcul en centimes : pas d'erreur d'arrondi
      if (info.credit) creditsCentimes += centimes;
      else debitsCentimes += centimes;

      const tr = document.createElement('tr');

      const tdDate = document.createElement('td');
      tdDate.textContent = formatDate(t.date_transaction);

      const tdType = document.createElement('td');
      const pastille = document.createElement('span');
      pastille.className = `pill ${info.credit ? 'pill-credit' : 'pill-debit'}`;
      pastille.textContent = info.libelle;
      tdType.append(pastille);

      const tdLibelle = document.createElement('td');
      tdLibelle.textContent = t.description || '—';
      if (info.contrepartie) {
        const sous = document.createElement('small');
        sous.className = 'muted iban';
        sous.textContent = info.contrepartie;
        tdLibelle.append(sous);
      }

      const tdMontant = document.createElement('td');
      tdMontant.className = `num ${info.credit ? 'credit' : 'debit'}`;
      tdMontant.textContent = `${info.credit ? '+' : '−'} ${formatEuro(t.montant)}`;

      tr.append(tdDate, tdType, tdLibelle, tdMontant);
      return tr;
    });

    tbody.replaceChildren(...rangees);
    $('total-credits').textContent = `+ ${formatEuro(creditsCentimes / 100)}`;
    $('total-debits').textContent = `− ${formatEuro(debitsCentimes / 100)}`;
    $('historique-etat').textContent = lignes.length
      ? `${lignes.length} opération${lignes.length > 1 ? 's' : ''}`
      : 'Aucune opération pour ces critères.';
  }

  // ===================== DÉMARRAGE =====================

  async function init() {
    // Utilisateur connecté ? (sinon getJson redirige vers /login.html)
    try {
      const { user } = await getJson('/api/auth/me');
      $('user-name').textContent = `${user.prenom} ${user.nom}`;
    } catch {
      return;
    }

    document.querySelectorAll('[data-operation]').forEach((onglet) =>
      onglet.addEventListener('click', () => choisirOperation(onglet.dataset.operation)));
    $('compte-select').addEventListener('change', changerCompte);
    $('operation-form').addEventListener('submit', soumettreOperation);
    $('btn-rafraichir').addEventListener('click', () => chargerComptes().then(chargerHistorique));
    $('filtres').addEventListener('submit', (e) => { e.preventDefault(); chargerHistorique(); });
    // "reset" vide les champs APRÈS l'événement : setTimeout attend la fin du reset
    $('filtres').addEventListener('reset', () => setTimeout(chargerHistorique));

    try {
      await chargerComptes();
      await chargerHistorique();
    } catch (erreur) {
      showMessage(erreur.message);
    }
    getCsrf().catch(() => {}); // pré-charge le jeton pour la première opération
  }

  document.addEventListener('DOMContentLoaded', init);
})();

