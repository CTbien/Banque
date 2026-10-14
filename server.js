import colors from 'colors';
import 'dotenv/config';
import app from './src/app.js';
import { testConnection } from './src/config/db.js';

const PORT = process.env.PORT || 3003;
const HOST = 'localhost';

const serveur = app.listen(PORT, async () => {
	console.log('');
	console.log(`---------------------------`.red.bgWhite );
	console.log(` API started on port ${PORT}     `.red.bgGreen );
	console.log(` Environnement : ${process.env.NODE_ENV}`);
	await testConnection();
});