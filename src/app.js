import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import compteRoutes from './routes/compteRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware pour parser le JSON
app.use(express.json());

// Lit les cookies (req.cookies.token), nécessaire au middleware auth
app.use(cookieParser());

// Servir les fichiers statiques du dossier public (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '../public')));

// Enregistrement des routes API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/comptes', compteRoutes);
app.use('/api/transactions', transactionRoutes);

// Route de test / healthcheck API
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', message: 'API Banque opérationnelle' });
});

export default app;
