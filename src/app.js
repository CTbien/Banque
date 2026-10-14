import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import compteRoutes from './routes/compteRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';

const app = express();

// Middleware pour parser le JSON
app.use(express.json());

// Lit les cookies (req.cookies.token), nécessaire au middleware auth
app.use(cookieParser());

// Route de test
app.get('/', (req, res) => {
    res.send('API Banque opérationnelle');
});

// Enregistrement des routes API
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/comptes', compteRoutes);
app.use('/api/transactions', transactionRoutes);

export default app;
