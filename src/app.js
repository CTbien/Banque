import express from 'express';
import cookieParser from 'cookie-parser';
import { csrfProtection } from './middlewares/csrf.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import compteRoutes from './routes/compteRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';

const app = express();

// Middleware pour parser le JSON
app.use(express.json());

// Lit les cookies (req.cookies.token), nécessaire au middleware auth
app.use(cookieParser());

// Protection CSRF sur tous les POST / PUT / PATCH / DELETE (en-tête x-csrf-token)
app.use(csrfProtection);

// Route de test
app.get('/', (req, res) => {
    res.send('API Banque opérationnelle');
});

// Enregistrement des routes API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/comptes', compteRoutes);
app.use('/api/transactions', transactionRoutes);

// Erreurs non gérées : réponse JSON au lieu d'une page HTML
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({ message: 'Jeton CSRF invalide ou manquant.' });
    }
    console.error(err);
    res.status(err.status || 500).json({ message: 'Erreur serveur.' });
});

export default app;
