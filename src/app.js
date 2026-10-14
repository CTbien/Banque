import express from 'express';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import compteRoutes from './routes/compteRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';

const app = express();

// Middleware pour parser le JSON
app.use(express.json());

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
