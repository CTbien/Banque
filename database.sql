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

-- =============================================================================
-- DONNÉES DE TEST
-- -----------------------------------------------------------------------------
-- Mots de passe (hashés avec bcrypt) :
--   admin@kampusbank.fr  → Admin1234   (administrateur)
--   tous les clients     → Client123
-- INSERT IGNORE + id fixes : le script peut être relancé sans créer de doublons.
-- Les soldes correspondent exactement à l'historique des transactions.
-- =============================================================================

INSERT IGNORE INTO users (id, nom, prenom, email, telephone, adresse_postale, date_naissance, mot_de_passe, is_admin) VALUES
(1, 'Admin',  'Kampus', 'admin@kampusbank.fr', '0100000000', '1 place de la Banque, 75001 Paris', '1985-01-15', '$2b$10$JkWPbE0tyUb0hfNLkPnp.e7azyrCTrMPja7IdKtHgbi8WMLZHEupG', TRUE),
(2, 'Dupont', 'Marie',  'marie.dupont@mail.fr', '0612345678', '12 rue des Lilas, 69003 Lyon',      '1999-05-12', '$2b$10$xpINKCwBwlnOzuM3rDMfQ.gybrNmRJLq1jeK8FPk8bIGBNY0YMh8G', FALSE),
(3, 'Martin', 'Lucas',  'lucas.martin@mail.fr', '0623456789', '8 avenue Foch, 33000 Bordeaux',     '1995-11-03', '$2b$10$xpINKCwBwlnOzuM3rDMfQ.gybrNmRJLq1jeK8FPk8bIGBNY0YMh8G', FALSE),
(4, 'Benali', 'Sarah',  'sarah.benali@mail.fr', '0734567890', '25 boulevard Victor Hugo, 06000 Nice', '2001-07-21', '$2b$10$xpINKCwBwlnOzuM3rDMfQ.gybrNmRJLq1jeK8FPk8bIGBNY0YMh8G', FALSE);

-- Comptes : Marie (2 comptes), Lucas (2 comptes), Sarah (1 compte bloqué + 1 compte vide supprimable)
INSERT IGNORE INTO comptes_bancaires (id, user_id, iban, type_compte, solde, statut, created_at) VALUES
(1, 2, 'FR76-YBNK-1024-5531-8842-1907-315', 'courant',  1250.50, 'actif',  '2026-09-01 09:00:00'),
(2, 2, 'FR76-YBNK-1024-5531-8842-6620-482', 'livret A', 3000.00, 'actif',  '2026-09-01 09:05:00'),
(3, 3, 'FR76-YBNK-2048-7714-3390-5126-907', 'courant',   849.50, 'actif',  '2026-09-03 14:20:00'),
(4, 3, 'FR76-YBNK-2048-7714-3390-8841-263', 'PEL',      5000.00, 'actif',  '2026-09-03 14:25:00'),
(5, 4, 'FR76-YBNK-4096-2208-6675-3349-158', 'courant',    80.00, 'bloqué', '2026-09-10 11:00:00'),
(6, 4, 'FR76-YBNK-4096-2208-6675-7712-604', 'livret A',    0.00, 'actif',  '2026-09-10 11:05:00');

-- Transactions (même format que le module Transactions) :
--   dépôt    → compte_destinataire_id seul
--   retrait  → compte_source_id seul
--   virement → une ligne 'virement_emis' de la source vers le destinataire
INSERT IGNORE INTO transactions (id, compte_source_id, compte_destinataire_id, type_transaction, montant, description, date_transaction) VALUES
(1,  NULL, 1,    'depot',         2000.00, 'Salaire septembre',               '2026-09-01 10:00:00'),
(2,  NULL, 2,    'depot',         3000.00, 'Épargne initiale',                '2026-09-01 10:05:00'),
(3,  NULL, 3,    'depot',         1500.00, 'Salaire septembre',               '2026-09-03 15:00:00'),
(4,  NULL, 4,    'depot',         4000.00, 'Ouverture PEL',                   '2026-09-03 15:10:00'),
(5,  NULL, 5,    'depot',           80.00, 'Dépôt espèces',                   '2026-09-10 11:30:00'),
(6,  1,    NULL, 'retrait',        300.00, 'Retrait distributeur',            '2026-09-12 18:45:00'),
(7,  1,    3,    'virement_emis',  449.50, 'Remboursement week-end',          '2026-09-15 20:10:00'),
(8,  3,    NULL, 'retrait',        100.00, 'Retrait espèces',                 '2026-09-18 12:00:00'),
(9,  3,    4,    'virement_emis', 1000.00, 'Virement vers mon PEL',           '2026-09-20 09:30:00');

-- Vérification des soldes :
--   compte 1 : 2000 - 300 - 449.50       = 1250.50
--   compte 2 : 3000                      = 3000.00
--   compte 3 : 1500 + 449.50 - 100 - 1000 =  849.50
--   compte 4 : 4000 + 1000               = 5000.00
--   compte 5 : 80                        =   80.00
--   compte 6 : aucune opération          =    0.00
