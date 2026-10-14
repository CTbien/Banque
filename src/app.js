// 1. Importer tes routes
const compteRoutes = require('./routes/compteRoutes');

// 2. Définir le préfixe d'URL (toutes tes routes commenceront par /api/comptes)
app.use('/api/comptes', compteRoutes);