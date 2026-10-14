// app.js : configure l'application Express (middlewares + routes).
// Démarrée par server.js.

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { csrfProtection } from './middlewares/csrf.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import compteRoutes from './routes/compteRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';

// Chemin du dossier courant (__dirname n'existe pas avec import, on le recrée)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware pour parser le JSON
app.use(express.json());

// Lit les cookies (req.cookies.token), nécessaire au middleware auth
app.use(cookieParser());

// Servir les fichiers statiques du dossier public (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '../public')));

// Protection CSRF sur tous les POST / PUT / PATCH / DELETE (en-tête x-csrf-token)
app.use(csrfProtection);

// Enregistrement des routes API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/comptes', compteRoutes);
app.use('/api/transactions', transactionRoutes);

// Route de test / healthcheck API
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', message: 'API Banque opérationnelle' });
});

// Erreurs non gérées : réponse JSON au lieu d'une page HTML
// (Express reconnaît un gestionnaire d'erreurs à ses 4 paramètres, next compris)
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({ message: 'Jeton CSRF invalide ou manquant.' });
    }
    console.error(err);
    res.status(err.status || 500).json({ message: 'Erreur serveur.' });
});

export default app;
