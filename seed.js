require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('./server/db');

console.log('🌱 Seeding...');

// Admin
const adminHash = bcrypt.hashSync('admin1234', 12);
db.prepare("INSERT OR IGNORE INTO admin (email, password_hash) VALUES (?, ?)").run('admin@serenity.com', adminHash);

// Collaboratrices
const marieHash = bcrypt.hashSync('test1234', 12);
const fatimaHash = bcrypt.hashSync('test1234', 12);

db.prepare(`
  INSERT OR IGNORE INTO collaborateurs (prenom, nom, email, password_hash, code_promo, taux_commission, reduction_client)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run('Marie', 'Dupont', 'marie@test.com', marieHash, 'MARIE15', 0.15, 0.08);

db.prepare(`
  INSERT OR IGNORE INTO collaborateurs (prenom, nom, email, password_hash, code_promo, taux_commission, reduction_client)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run('Fatima', 'Martin', 'fatima@test.com', fatimaHash, 'FATIMA10', 0.10, 0.05);

const marie = db.prepare("SELECT * FROM collaborateurs WHERE code_promo = 'MARIE15'").get();
const fatima = db.prepare("SELECT * FROM collaborateurs WHERE code_promo = 'FATIMA10'").get();

// Utilisations de test — Marie (MARIE15 · 15% comm · 8% reduc)
const utilisationsMarie = [
  { ref: 'CMD-001', client_email: 'alice@email.com', client_prenom: 'Alice',  produit: 'Pack 5 Slips Standard', prix: 29.95, statut: 'payee'       },
  { ref: 'CMD-002', client_email: 'lucie@email.com', client_prenom: 'Lucie',  produit: 'Sport Bra & Slip',      prix: 11.99, statut: 'confirmee'    },
  { ref: 'CMD-003', client_email: 'emma@email.com',  client_prenom: 'Emma',   produit: 'Pack 5 Slips Sur Mesure',prix: 29.95, statut: 'en_attente'  },
  { ref: 'CMD-004', client_email: 'chloe@email.com', client_prenom: 'Chloé',  produit: 'Sport Bra & Slip',      prix: 11.99, statut: 'en_attente'  },
];

// Utilisations de test — Fatima (FATIMA10 · 10% comm · 5% reduc)
const utilisationsFatima = [
  { ref: 'CMD-005', client_email: 'sara@email.com',  client_prenom: 'Sara',  produit: 'Pack 5 Slips Standard', prix: 29.95, statut: 'confirmee'    },
  { ref: 'CMD-006', client_email: 'nora@email.com',  client_prenom: 'Nora',  produit: 'Sport Bra & Slip',      prix: 11.99, statut: 'en_attente'  },
];

function insertUtilisation(collab, u) {
  const red = parseFloat((u.prix * collab.reduction_client).toFixed(2));
  const paye = parseFloat((u.prix - red).toFixed(2));
  const comm = parseFloat((paye * collab.taux_commission).toFixed(2));

  const existing = db.prepare('SELECT id FROM utilisations_code WHERE commande_ref = ?').get(u.ref);
  if (existing) return;

  db.prepare(`
    INSERT INTO utilisations_code
      (collab_id, commande_ref, client_email, client_prenom, produit, prix_catalogue, montant_reduction, prix_paye, montant_commission, statut, date_confirmation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    collab.id, u.ref, u.client_email, u.client_prenom, u.produit,
    u.prix, red, paye, comm, u.statut,
    u.statut !== 'en_attente' ? new Date().toISOString() : null
  );

  // Mettre à jour les gains du collab
  if (u.statut === 'en_attente') {
    db.prepare('UPDATE collaborateurs SET gains_en_attente = gains_en_attente + ? WHERE id = ?').run(comm, collab.id);
  } else if (u.statut === 'confirmee') {
    db.prepare('UPDATE collaborateurs SET gains_confirmes = gains_confirmes + ? WHERE id = ?').run(comm, collab.id);
  } else if (u.statut === 'payee') {
    db.prepare('UPDATE collaborateurs SET gains_payes = gains_payes + ? WHERE id = ?').run(comm, collab.id);
  }
}

utilisationsMarie.forEach(u => insertUtilisation(marie, u));
utilisationsFatima.forEach(u => insertUtilisation(fatima, u));

console.log('✅ Seed terminé.');
console.log('   Admin       : admin@serenity.com / admin1234');
console.log('   Collab 1    : marie@test.com / test1234 · MARIE15');
console.log('   Collab 2    : fatima@test.com / test1234 · FATIMA10');
