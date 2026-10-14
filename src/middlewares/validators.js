// validators.js : règles de validation des formulaires (express-validator).
// Utilisation : router.post('/register', registerRules, validate, controller.register);

import { body, validationResult } from 'express-validator';

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
const motDePasseRule = body('mot_de_passe')
    .isLength({ min: 8 }).withMessage('Le mot de passe doit faire au moins 8 caractères.')
    .matches(/[A-Z]/).withMessage('Le mot de passe doit contenir au moins 1 majuscule.')
    .matches(/\d/).withMessage('Le mot de passe doit contenir au moins 1 chiffre.');

// Inscription
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
    motDePasseRule
];

// Connexion
export const loginRules = [
    body('email').trim().toLowerCase().isEmail().withMessage('Email invalide.'),
    body('mot_de_passe').notEmpty().withMessage('Le mot de passe est obligatoire.')
];
