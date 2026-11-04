// profil.js : modifier ses informations et son mot de passe.
// Utilisé par profil.html. Les outils (sendJson, showMessage…) viennent de auth.js.

const CHAMPS_PROFIL = ['prenom', 'nom', 'email', 'telephone', 'date_naissance', 'adresse_postale'];

// Remplit le formulaire avec les informations actuelles.
async function chargerProfil() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) {
    window.location.href = '/login.html';
    return;
  }

  const { user } = await res.json();
  const form = document.getElementById('profil-form');
  CHAMPS_PROFIL.forEach((champ) => (form[champ].value = user[champ] ?? ''));
  afficherNom(user);
}

function afficherNom(user) {
  document.getElementById('user-name').textContent = `${user.prenom} ${user.nom}`;
}

// PUT /api/users/me
async function enregistrerProfil(event) {
  event.preventDefault();
  const form = event.target;
  clearErrors(form);

  const valeurs = Object.fromEntries(new FormData(form));
  Object.keys(valeurs).forEach((k) => (valeurs[k] = valeurs[k].trim()));

  if (!/^\d{10}$/.test(valeurs.telephone)) {
    return showFieldError('telephone', 'Le téléphone doit contenir 10 chiffres.');
  }

  const bouton = form.querySelector('button');
  bouton.disabled = true;

  try {
    const { ok, data } = await sendJson('PUT', '/api/users/me', valeurs);
    if (!ok) return showServerErrors(data);

    afficherNom(data.user);
    showMessage('Informations mises à jour.', 'success');
  } catch (erreur) {
    showMessage('Impossible de contacter le serveur.');
  } finally {
    bouton.disabled = false;
  }
}

// PUT /api/users/me/password
async function changerMotDePasse(event) {
  event.preventDefault();
  const form = event.target;
  clearErrors(form);

  const nouveau = form.nouveau_mot_de_passe.value;

  const erreurMdp = checkPassword(nouveau);
  if (erreurMdp) return showFieldError('nouveau_mot_de_passe', erreurMdp);
  if (nouveau !== form.confirmation.value) {
    return showFieldError('confirmation', 'Les mots de passe ne correspondent pas.');
  }

  const bouton = form.querySelector('button');
  bouton.disabled = true;

  try {
    const { ok, data } = await sendJson('PUT', '/api/users/me/password', {
      ancien_mot_de_passe: form.ancien_mot_de_passe.value,
      nouveau_mot_de_passe: nouveau
    });
    if (!ok) return showServerErrors(data);

    form.reset();
    showMessage('Mot de passe modifié.', 'success');
  } catch (erreur) {
    showMessage('Impossible de contacter le serveur.');
  } finally {
    bouton.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('profil-form').addEventListener('submit', enregistrerProfil);
  document.getElementById('mdp-form').addEventListener('submit', changerMotDePasse);
  chargerProfil();
});
