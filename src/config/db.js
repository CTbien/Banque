import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import colors from 'colors';

dotenv.config();

// Configuration du pool de connexions MySQL
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'banque_db',
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Fonction pour tester la connexion à la base de données
export const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Connecté avec succès à la base de données MySQL !'.green);
        connection.release();
    } catch (error) {
        console.error('❌ Erreur de connexion à la base de données MySQL :'.red, error.message);
    }
};

export { pool };
export default pool;
