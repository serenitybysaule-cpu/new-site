require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || './server/serenity_collab.db';
const db = new Database(path.resolve(DB_PATH));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS collaborateurs (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    prenom               TEXT NOT NULL,
    nom                  TEXT NOT NULL,
    email                TEXT UNIQUE NOT NULL,
    password_hash        TEXT NOT NULL,
    code_promo           TEXT UNIQUE,
    taux_commission      REAL DEFAULT 0,
    reduction_client     REAL DEFAULT 0,
    statut               TEXT DEFAULT 'en_attente',
    gains_en_attente     REAL DEFAULT 0.0,
    gains_confirmes      REAL DEFAULT 0.0,
    gains_payes          REAL DEFAULT 0.0,
    telephone            TEXT,
    instagram            TEXT,
    message_inscription  TEXT,
    date_creation        DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS utilisations_code (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    collab_id           INTEGER NOT NULL REFERENCES collaborateurs(id),
    commande_ref        TEXT NOT NULL,
    client_email        TEXT,
    client_prenom       TEXT,
    produit             TEXT NOT NULL,
    prix_catalogue      REAL NOT NULL,
    montant_reduction   REAL NOT NULL,
    prix_paye           REAL NOT NULL,
    montant_commission  REAL NOT NULL,
    statut              TEXT DEFAULT 'en_attente',
    date_utilisation    DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_confirmation   DATETIME
  );

  CREATE TABLE IF NOT EXISTS paiements_collab (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    collab_id     INTEGER NOT NULL REFERENCES collaborateurs(id),
    montant       REAL NOT NULL,
    methode       TEXT,
    reference     TEXT,
    note          TEXT,
    date_paiement DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );
`);

if (require.main === module) {
  console.log('✅ Base de données initialisée :', path.resolve(DB_PATH));
}

module.exports = db;
