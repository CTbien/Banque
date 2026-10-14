// db.js : connexion à MySQL, partagée par toute l'application.

import mysql from 'mysql2/promise'; // version "promise" : permet d'utiliser await
import dotenv from 'dotenv';
import colors from 'colors'; // couleurs dans la console (.green, .red)

// Charge les variables du fichier .env dans process.env.
dotenv.config();

// Pool = réserve de connexions déjà ouvertes, prêtées à chaque requête.
// Les valeurs après || sont utilisées si la variable manque dans .env.
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'banque_db',
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true, // si tout est occupé, on attend au lieu d'échouer
    connectionLimit: 10,      // 10 connexions maximum
    queueLimit: 0             // file d'attente illimitée
});

// Vérifie au démarrage que MySQL répond.
export const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Connecté avec succès à la base de données MySQL !'.green);
        connection.release(); // toujours rendre la connexion au pool
    } catch (error) {
        console.error('❌ Erreur de connexion à la base de données MySQL :'.red, error.message);
    }
};

// Utilisation : import pool from '../config/db.js';
export { pool };
export default pool;
