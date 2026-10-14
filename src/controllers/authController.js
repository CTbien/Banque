// authController.js : inscription, connexion, déconnexion, utilisateur connecté.
// La validation des champs (email, mot de passe…) est faite avant, dans authRoutes.js.

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import UserModel from '../models/UserModel.js';

// Durée de connexion : 2 heures (en secondes).
const DUREE_SESSION = 2 * 60 * 60;

// Nombre de "tours" de bcrypt : plus c'est haut, plus c'est lent à casser (10 = standard).
const BCRYPT_ROUNDS = 10;

// Options du cookie qui contient le token.
const cookieOptions = {
    httpOnly: true,                                 // invisible pour le JavaScript de la page (anti-vol XSS)
    sameSite: 'strict',                             // jamais envoyé depuis un autre site (anti-CSRF)
    secure: process.env.NODE_ENV === 'production',  // HTTPS uniquement en production
    maxAge: DUREE_SESSION * 1000                    // en millisecondes
};

const authController = {

    // POST /api/auth/register : créer un compte client
    async register(req, res) {
        try {
            const { nom, prenom, email, telephone, adresse_postale, date_naissance, mot_de_passe } = req.body;

            // Email déjà utilisé ? → 409 (conflit)
            if (await UserModel.emailExists(email)) {
                return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
            }

            // On hashe le mot de passe : on ne stocke jamais le mot de passe en clair.
            const hash = await bcrypt.hash(mot_de_passe, BCRYPT_ROUNDS);

            const id = await UserModel.create({
                nom, prenom, email, telephone, adresse_postale, date_naissance,
                mot_de_passe: hash
            });

            return res.status(201).json({ message: 'Compte créé avec succès.', id });
        } catch (erreur) {
            // Deux inscriptions identiques en même temps : MySQL bloque grâce à UNIQUE.
            if (erreur.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: 'Cet email est déjà utilisé.' });
            }
            return res.status(500).json({ message: 'Erreur serveur.' });
        }
    },

    // POST /api/auth/login : se connecter
    async login(req, res) {
        try {
            const { email, mot_de_passe } = req.body;

            const user = await UserModel.findByEmailWithPassword(email);

            // bcrypt.compare hashe le mot de passe tapé et le compare au hash en base.
            const motDePasseOk = user && await bcrypt.compare(mot_de_passe, user.mot_de_passe);

            // Même message dans les deux cas : on ne dit pas si c'est l'email ou le mot de passe qui est faux.
            if (!motDePasseOk) {
                return res.status(401).json({ message: 'Email ou mot de passe incorrect.' });
            }

            // Création du token (le "badge") : contient l'id et le rôle, signé avec la clé secrète.
            const token = jwt.sign(
                { id: user.id, is_admin: Boolean(user.is_admin) },
                process.env.JWT_SECRET,
                { expiresIn: DUREE_SESSION }
            );

            // Le token est rangé dans un cookie httpOnly : le navigateur le renverra tout seul.
            res.cookie('token', token, cookieOptions);

            // On renvoie l'utilisateur SANS son mot de passe.
            const { mot_de_passe: _, ...userSansMotDePasse } = user;
            return res.status(200).json({ message: 'Connexion réussie.', user: userSansMotDePasse });
        } catch (erreur) {
            return res.status(500).json({ message: 'Erreur serveur.' });
        }
    },

    // POST /api/auth/logout : se déconnecter
    async logout(req, res) {
        // Mêmes options qu'à la création, sinon le navigateur ne supprime pas le cookie.
        const { maxAge, ...options } = cookieOptions;
        res.clearCookie('token', options);
        return res.status(200).json({ message: 'Déconnexion réussie.' });
    },

    // GET /api/auth/me : infos de l'utilisateur connecté (route protégée par auth)
    async me(req, res) {
        try {
            const user = await UserModel.findById(req.user.id);

            // Le token est valide mais l'utilisateur a été supprimé entre-temps.
            if (!user) {
                return res.status(404).json({ message: 'Utilisateur introuvable.' });
            }

            return res.status(200).json({ user });
        } catch (erreur) {
            return res.status(500).json({ message: 'Erreur serveur.' });
        }
    }
};

export default authController;
