# Diagramme de la base de données KampusBank

Base `banque_db`, créée par `database.sql`. GitHub affiche le diagramme ci-dessous directement.

## MCD (modèle conceptuel)

```mermaid
erDiagram
    USER ||--o{ COMPTE_BANCAIRE : "possède"
    COMPTE_BANCAIRE |o--o{ TRANSACTION : "envoie"
    COMPTE_BANCAIRE |o--o{ TRANSACTION : "reçoit"

    USER {
        int id PK
        string nom
        string prenom
        string email UK
        string telephone
        string adresse_postale
        date date_naissance
        string mot_de_passe
        boolean is_admin
        datetime created_at
    }
    COMPTE_BANCAIRE {
        int id PK
        int user_id FK
        string iban UK
        enum type_compte
        decimal solde
        enum statut
        datetime created_at
    }
    TRANSACTION {
        int id PK
        int compte_source_id FK
        int compte_destinataire_id FK
        enum type_transaction
        decimal montant
        string description
        datetime date_transaction
    }
```

### Cardinalités

| Relation | Côté A | Côté B | Sens |
|---|---|---|---|
| USER possède COMPTE_BANCAIRE | 0,N | 1,1 | Un client a plusieurs comptes, un compte a un seul propriétaire |
| COMPTE_BANCAIRE envoie TRANSACTION | 0,N | 0,1 | Un retrait ou un virement part d'un compte, un dépôt n'a pas de source |
| COMPTE_BANCAIRE reçoit TRANSACTION | 0,N | 0,1 | Un dépôt ou un virement arrive sur un compte, un retrait n'a pas de destinataire |

Un virement relie deux comptes : `compte_source_id` et `compte_destinataire_id` sont remplis.

## MLD (modèle logique)

**users** (<u>id</u>, nom, prenom, email, telephone, adresse_postale, date_naissance, mot_de_passe, is_admin, created_at)

- `email` : unique

**comptes_bancaires** (<u>id</u>, #user_id, iban, type_compte, solde, statut, created_at)

- `user_id` → `users.id`, `ON DELETE CASCADE`
- `iban` : unique, format `FR76-YBNK-XXXX-XXXX-XXXX-XXXX-XXX`
- `type_compte` : `courant`, `livret A` ou `PEL`
- `statut` : `actif` (par défaut) ou `bloqué`
- `solde` : 0.00 par défaut

**transactions** (<u>id</u>, #compte_source_id, #compte_destinataire_id, type_transaction, montant, description, date_transaction)

- `compte_source_id` → `comptes_bancaires.id`, `ON DELETE SET NULL`
- `compte_destinataire_id` → `comptes_bancaires.id`, `ON DELETE SET NULL`
- `type_transaction` : `depot`, `retrait`, `virement_emis` ou `virement_recu`
- `montant` : strictement positif (contrainte `CHECK`)
- `description` : peut être vide

Les colonnes `#` sont des clés étrangères, la colonne soulignée est la clé primaire.
