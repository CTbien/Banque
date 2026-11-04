// validators.js : règles de validation des formulaires (express-validator).
// Utilisation : router.post('/register', registerRules, validate, controller.register);

import { body, param, query, validationResult } from 'express-validator';

// Renvoie 400 avec la liste des erreurs si une règle n'est pas respectée.
export const validate = (req, res, next) => {
    const erreurs = validationResult(req);
    if (!erreurs.isEmpty()) {
        return res.status(400).json({
            message: 'Données invalides.',
            erreurs: erreurs.array().map((e) => ({ champ: e.path, message: e.msg }))
        });
    }
    next();
};

// Règle mot de passe : 8 caractères min, 1 majuscule, 1 chiffre.
const motDePasseRule = (champ = 'mot_de_passe') => body(champ)
    .isLength({ min: 8 }).withMessage('Le mot de passe doit faire au moins 8 caractères.')
    .matches(/[A-Z]/).withMessage('Le mot de passe doit contenir au moins 1 majuscule.')
    .matches(/\d/).withMessage('Le mot de passe doit contenir au moins 1 chiffre.');

// Inscription
// trim() enlève les espaces autour, toLowerCase() met l'email en minuscules.
// optional({ values: 'falsy' }) : champ facultatif, ignoré s'il est vide.
export const registerRules = [
    body('nom').trim().notEmpty().withMessage('Le nom est obligatoire.')
        .isLength({ max: 100 }).withMessage('Le nom est trop long.'),
    body('prenom').trim().notEmpty().withMessage('Le prénom est obligatoire.')
        .isLength({ max: 100 }).withMessage('Le prénom est trop long.'),
    body('email').trim().toLowerCase().isEmail().withMessage('Email invalide.'),
    body('telephone').trim().matches(/^\d{10}$/).withMessage('Le téléphone doit contenir 10 chiffres.'),
    body('adresse_postale').optional({ values: 'falsy' }).trim()
        .isLength({ max: 255 }).withMessage("L'adresse est trop longue."),
    body('date_naissance').optional({ values: 'falsy' })
        .isISO8601().withMessage('Date de naissance invalide (format AAAA-MM-JJ).'),
    motDePasseRule()
];

// Connexion
export const loginRules = [
    body('email').trim().toLowerCase().isEmail().withMessage('Email invalide.'),
    body('mot_de_passe').notEmpty().withMessage('Le mot de passe est obligatoire.')
];

// Modification du profil : mêmes règles que l'inscription, mais chaque champ est facultatif.
export const updateProfileRules = [
    body('nom').optional().trim().notEmpty().withMessage('Le nom ne peut pas être vide.')
        .isLength({ max: 100 }).withMessage('Le nom est trop long.'),
    body('prenom').optional().trim().notEmpty().withMessage('Le prénom ne peut pas être vide.')
        .isLength({ max: 100 }).withMessage('Le prénom est trop long.'),
    body('email').optional().trim().toLowerCase().isEmail().withMessage('Email invalide.'),
    body('telephone').optional().trim().matches(/^\d{10}$/).withMessage('Le téléphone doit contenir 10 chiffres.'),
    body('adresse_postale').optional().trim()
        .isLength({ max: 255 }).withMessage("L'adresse est trop longue."),
    body('date_naissance').optional({ values: 'falsy' })
        .isISO8601().withMessage('Date de naissance invalide (format AAAA-MM-JJ).')
];

// Changement de mot de passe
export const changePasswordRules = [
    body('ancien_mot_de_passe').notEmpty().withMessage("L'ancien mot de passe est obligatoire."),
    motDePasseRule('nouveau_mot_de_passe')
];

// :id dans l'URL doit être un nombre entier positif (toInt() le convertit en nombre)
export const idParamRule = [
    param('id').isInt({ min: 1 }).withMessage('Identifiant invalide.').toInt()
];

// Montant : nombre positif, 2 décimales maximum, entre min et max (en euros).
const montantRule = (min, max = Infinity) => body('montant').custom((valeur) => {
    const estNombreOuTexte = typeof valeur === 'number' || typeof valeur === 'string';
    if (!estNombreOuTexte || !/^\d+(\.\d{1,2})?$/.test(String(valeur))) {
        throw new Error('Le montant doit être un nombre positif avec 2 décimales maximum.');
    }
    if (Number(valeur) < min) throw new Error(`Le montant minimum est de ${min} €.`);
    if (Number(valeur) > max) throw new Error(`Le montant maximum est de ${max} €.`);
    return true;
});

// Identifiant de compte envoyé dans le corps de la requête
const compteIdRule = (champ) => body(champ)
    .isInt({ min: 1 }).withMessage('Compte invalide.').toInt();

// Libellé facultatif
const descriptionRule = body('description').optional({ values: 'falsy' })
    .isString().withMessage('Libellé invalide.').trim()
    .isLength({ max: 255 }).withMessage('Le libellé est trop long.');

// Dépôt : 1 € minimum
export const depotRules = [compteIdRule('compte_id'), montantRule(1), descriptionRule];

// Retrait : entre 1 € et 1000 €
export const retraitRules = [compteIdRule('compte_id'), montantRule(1, 1000), descriptionRule];

// Virement : 1 € minimum, IBAN du destinataire au format de la banque
export const virementRules = [
    compteIdRule('compte_source_id'),
    body('dest_iban').isString().withMessage('IBAN invalide.').trim().toUpperCase()
        .matches(/^FR76-YBNK-\d{4}-\d{4}-\d{4}-\d{4}-\d{3}$/).withMessage('IBAN invalide.'),
    montantRule(1),
    descriptionRule
];

// ?q= pour la recherche admin (facultatif)
export const searchRules = [
    query('q').optional().trim().isLength({ max: 100 }).withMessage('Recherche trop longue.')
];
