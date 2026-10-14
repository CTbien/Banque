// auth.js : connexion, inscription et déconnexion côté navigateur.
// Utilisé par login.html et register.html.
// Sur les autres pages, un bouton avec l'attribut data-logout déconnecte l'utilisateur.

// ===================== OUTILS =====================

// Demande un jeton CSRF au serveur (à faire avant chaque formulaire).
async function getCsrfToken() {
  const res = await fetch('/api/auth/csrf-token');
  const data = await res.json();
  return data.csrfToken;
}

// Envoie un POST en JSON avec le jeton CSRF. Renvoie { ok, status, data }.
async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': await getCsrfToken()
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({})); // {} si la réponse n'est pas du JSON
  return { ok: res.ok, status: res.status, data };
}

// Affiche un message en haut du formulaire (type : 'error' ou 'success').
function showMessage(texte, type = 'error') {
  const el = document.getElementById('message');
  el.textContent = texte; // textContent (et pas innerHTML) : pas d'injection de HTML
  el.className = `message ${type}-msg`;
  el.hidden = false;
}

// Affiche une erreur sous un champ.
function showFieldError(champ, texte) {
  const el = document.querySelector(`[data-error-for="${champ}"]`);
  const input = document.getElementById(champ);
  if (el) el.textContent = texte;
  if (input) input.setAttribute('aria-invalid', 'true');
}

// Efface toutes les erreurs du formulaire.
function clearErrors(form) {
  form.querySelectorAll('.error').forEach((el) => (el.textContent = ''));
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  document.getElementById('message').hidden = true;
}

// Affiche les erreurs renvoyées par le serveur (format { erreurs: [{ champ, message }] }).
function showServerErrors(data) {
  if (data.erreurs) {
    data.erreurs.forEach((e) => showFieldError(e.champ, e.message));
  }
  showMessage(data.message || 'Une erreur est survenue.');
}

// Vérifications côté navigateur (le serveur revérifie tout de toute façon).
function checkPassword(mdp) {
  if (mdp.length < 8) return 'Le mot de passe doit faire au moins 8 caractères.';
  if (!/[A-Z]/.test(mdp)) return 'Le mot de passe doit contenir au moins 1 majuscule.';
  if (!/\d/.test(mdp)) return 'Le mot de passe doit contenir au moins 1 chiffre.';
  return null;
}

// ===================== CONNEXION =====================

async function handleLogin(event) {
  event.preventDefault(); // empêche le rechargement de la page
  const form = event.target;
  clearErrors(form);

  const email = form.email.value.trim();
  const mot_de_passe = form.mot_de_passe.value;

  if (!email) return showFieldError('email', "L'email est obligatoire.");
  if (!mot_de_passe) return showFieldError('mot_de_passe', 'Le mot de passe est obligatoire.');

  const bouton = form.querySelector('button');
  bouton.disabled = true;

  try {
    const { ok, data } = await postJson('/api/auth/login', { email, mot_de_passe });
    if (!ok) return showServerErrors(data);

    // Connecté : le cookie est posé par le serveur, on va au tableau de bord.
    window.location.href = '/dashboard.html';
  } catch (erreur) {
    showMessage('Impossible de contacter le serveur.');
  } finally {
    bouton.disabled = false; // finally : exécuté dans tous les cas (succès ou erreur)
  }
}

// ===================== INSCRIPTION =====================

async function handleRegister(event) {
  event.preventDefault();
  const form = event.target;
  clearErrors(form);

  // Récupère tous les champs du formulaire dans un objet { nom: ..., prenom: ... }.
  const valeurs = Object.fromEntries(new FormData(form));
  Object.keys(valeurs).forEach((k) => (valeurs[k] = valeurs[k].trim()));

  // Vérifications rapides avant d'envoyer.
  let valide = true;
  if (!valeurs.prenom) { showFieldError('prenom', 'Le prénom est obligatoire.'); valide = false; }
  if (!valeurs.nom) { showFieldError('nom', 'Le nom est obligatoire.'); valide = false; }
  if (!form.email.checkValidity() || !valeurs.email) { showFieldError('email', 'Email invalide.'); valide = false; }
  if (!/^\d{10}$/.test(valeurs.telephone)) { showFieldError('telephone', 'Le téléphone doit contenir 10 chiffres.'); valide = false; }

  const erreurMdp = checkPassword(form.mot_de_passe.value);
  if (erreurMdp) { showFieldError('mot_de_passe', erreurMdp); valide = false; }
  if (form.mot_de_passe.value !== form.confirmation.value) {
    showFieldError('confirmation', 'Les mots de passe ne correspondent pas.');
    valide = false;
  }
  if (!valide) return;

  // On n'envoie pas la confirmation, et le mot de passe n'est pas "trimé".
  delete valeurs.confirmation;
  valeurs.mot_de_passe = form.mot_de_passe.value;

  const bouton = form.querySelector('button');
  bouton.disabled = true;

  try {
    const { ok, data } = await postJson('/api/auth/register', valeurs);
    if (!ok) return showServerErrors(data);

    // Compte créé : on envoie vers la connexion avec un message de succès.
    window.location.href = '/login.html?inscrit=1';
  } catch (erreur) {
    showMessage('Impossible de contacter le serveur.');
  } finally {
    bouton.disabled = false;
  }
}

// ===================== DÉCONNEXION =====================

async function logout() {
  try {
    await postJson('/api/auth/logout', {});
  } finally {
    window.location.href = '/login.html';
  }
}

// ===================== DÉMARRAGE =====================

document.addEventListener('DOMContentLoaded', async () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);

    // Message après une inscription réussie (URL : /login.html?inscrit=1).
    if (new URLSearchParams(window.location.search).get('inscrit')) {
      showMessage('Compte créé ! Vous pouvez vous connecter.', 'success');
    }
  }

  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }

  // Déjà connecté sur la page de connexion ou d'inscription ? → tableau de bord.
  if (loginForm || registerForm) {
    const res = await fetch('/api/auth/me');
    if (res.ok) window.location.href = '/dashboard.html';
  }

  // Tous les boutons data-logout de la page déconnectent l'utilisateur.
  document.querySelectorAll('[data-logout]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
  });
});
