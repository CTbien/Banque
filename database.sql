CREATE DATABASE IF NOT EXISTS banque_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE banque_db;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telephone VARCHAR(25),
    adresse_postale TEXT,
    date_naissance DATE,
    mot_de_passe VARCHAR(255) NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS comptes_bancaires (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    iban VARCHAR(34) NOT NULL UNIQUE,
    type_compte ENUM('courant', 'livret A', 'PEL') NOT NULL DEFAULT 'courant',
    solde DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    statut ENUM('actif', 'bloqué') NOT NULL DEFAULT 'actif',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_comptes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    compte_source_id INT,
    compte_destinataire_id INT,
    type_transaction ENUM('depot', 'retrait', 'virement_emis', 'virement_recu') NOT NULL,
    montant DECIMAL(15, 2) NOT NULL,
    description VARCHAR(255),
    date_transaction DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_montant_positif CHECK (montant > 0),
    CONSTRAINT fk_trans_source FOREIGN KEY (compte_source_id) REFERENCES comptes_bancaires(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_trans_dest FOREIGN KEY (compte_destinataire_id) REFERENCES comptes_bancaires(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;