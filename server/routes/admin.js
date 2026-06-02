const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

// Middleware JWT admin
function authAdmin(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Token manquant.' });
  try {
    const payload = jwt.verify(header.replace('Bearer ', ''), process.env.JWT_SECRET);
    if (payload.role !== 'admin') throw new Error();
    req.adminId = payload.id;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
}

// ── Inscriptions en attente ────────────────────────────────────────────────

// GET /api/admin/inscriptions-en-attente
router.get('/inscriptions-en-attente', authAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT id, prenom, nom, email, telephone, instagram, message_inscription, date_creation FROM collaborateurs WHERE statut = 'en_attente' ORDER BY date_creation DESC"
  ).all();
  res.json(rows);
});

// POST /api/admin/activer-inscription/:id
router.post('/activer-inscription/:id', authAdmin, (req, res) => {
  const { code_promo, taux_commission, reduction_client } = req.body;
  if (!code_promo || !taux_commission || !reduction_client)
    return res.status(400).json({ error: 'Code promo, taux et réduction requis.' });

  const collab = db.prepare("SELECT * FROM collaborateurs WHERE id = ? AND statut = 'en_attente'").get(req.params.id);
  if (!collab) return res.status(404).json({ error: 'Inscription introuvable ou déjà traitée.' });

  const existing = db.prepare('SELECT id FROM collaborateurs WHERE code_promo = ? AND id != ?').get(code_promo.toUpperCase(), collab.id);
  if (existing) return res.status(409).json({ error: 'Ce code promo est déjà utilisé.' });

  db.prepare(`
    UPDATE collaborateurs SET statut = 'actif', code_promo = ?, taux_commission = ?, reduction_client = ? WHERE id = ?
  `).run(code_promo.toUpperCase().trim(), parseFloat(taux_commission), parseFloat(reduction_client), collab.id);

  res.json({ message: 'Compte activé avec succès.' });
});

// DELETE /api/admin/inscriptions/:id — refuser une inscription
router.delete('/inscriptions/:id', authAdmin, (req, res) => {
  const collab = db.prepare("SELECT * FROM collaborateurs WHERE id = ? AND statut = 'en_attente'").get(req.params.id);
  if (!collab) return res.status(404).json({ error: 'Inscription introuvable.' });
  db.prepare('DELETE FROM collaborateurs WHERE id = ?').run(collab.id);
  res.json({ message: 'Inscription refusée et supprimée.' });
});

// ── Collaborateurs ──────────────────────────────────────────────────────────

// GET /api/admin/collaborateurs
router.get('/collaborateurs', authAdmin, (req, res) => {
  const rows = db.prepare(
    "SELECT id, prenom, nom, email, code_promo, taux_commission, reduction_client, statut, gains_en_attente, gains_confirmes, gains_payes, date_creation FROM collaborateurs WHERE statut != 'en_attente' ORDER BY date_creation DESC"
  ).all();
  res.json(rows);
});

// POST /api/admin/collaborateurs — créer
router.post('/collaborateurs', authAdmin, (req, res) => {
  const { prenom, nom, email, password, code_promo, taux_commission, reduction_client } = req.body;

  if (!prenom || !nom || !email || !password || !code_promo)
    return res.status(400).json({ error: 'Champs requis manquants.' });

  const taux = parseFloat(taux_commission);
  const reduc = parseFloat(reduction_client);
  if (isNaN(taux) || isNaN(reduc))
    return res.status(400).json({ error: 'Taux invalides.' });

  const existing = db.prepare('SELECT id FROM collaborateurs WHERE email = ? OR code_promo = ?').get(email.toLowerCase(), code_promo.toUpperCase());
  if (existing) return res.status(409).json({ error: 'Email ou code promo déjà utilisé.' });

  const hash = bcrypt.hashSync(password, 12);
  const result = db.prepare(`
    INSERT INTO collaborateurs (prenom, nom, email, password_hash, code_promo, taux_commission, reduction_client)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(prenom.trim(), nom.trim(), email.toLowerCase().trim(), hash, code_promo.toUpperCase().trim(), taux, reduc);

  res.status(201).json({ id: result.lastInsertRowid, message: 'Collaborateur créé.' });
});

// PATCH /api/admin/collaborateurs/:id/statut
router.patch('/collaborateurs/:id/statut', authAdmin, (req, res) => {
  const { statut } = req.body;
  if (!['actif', 'suspendu'].includes(statut))
    return res.status(400).json({ error: 'Statut invalide.' });

  db.prepare('UPDATE collaborateurs SET statut = ? WHERE id = ?').run(statut, req.params.id);
  res.json({ message: 'Statut mis à jour.' });
});

// ── Commandes ───────────────────────────────────────────────────────────────

// GET /api/admin/commandes-en-attente
router.get('/commandes-en-attente', authAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT u.*, c.prenom AS collab_prenom, c.nom AS collab_nom, c.code_promo
    FROM utilisations_code u
    JOIN collaborateurs c ON c.id = u.collab_id
    WHERE u.statut = 'en_attente'
    ORDER BY u.date_utilisation DESC
  `).all();
  res.json(rows);
});

// POST /api/admin/commandes — enregistrer une utilisation de code
router.post('/commandes', authAdmin, (req, res) => {
  const { code_promo, commande_ref, client_email, client_prenom, produit, prix_catalogue } = req.body;

  if (!code_promo || !commande_ref || !produit || !prix_catalogue)
    return res.status(400).json({ error: 'Champs requis manquants.' });

  const collab = db.prepare("SELECT * FROM collaborateurs WHERE code_promo = ? AND statut = 'actif'").get(code_promo.toUpperCase().trim());
  if (!collab) return res.status(404).json({ error: 'Code promo invalide ou inactif.' });

  const prix = parseFloat(prix_catalogue);
  const montant_reduction = parseFloat((prix * collab.reduction_client).toFixed(2));
  const prix_paye = parseFloat((prix - montant_reduction).toFixed(2));
  const montant_commission = parseFloat((prix_paye * collab.taux_commission).toFixed(2));

  const result = db.prepare(`
    INSERT INTO utilisations_code
      (collab_id, commande_ref, client_email, client_prenom, produit, prix_catalogue, montant_reduction, prix_paye, montant_commission)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(collab.id, commande_ref.trim(), client_email || '', client_prenom || '', produit.trim(), prix, montant_reduction, prix_paye, montant_commission);

  db.prepare('UPDATE collaborateurs SET gains_en_attente = gains_en_attente + ? WHERE id = ?')
    .run(montant_commission, collab.id);

  res.status(201).json({ id: result.lastInsertRowid, montant_commission, message: 'Commande enregistrée.' });
});

// PATCH /api/admin/commandes/:id/confirmer
router.patch('/commandes/:id/confirmer', authAdmin, (req, res) => {
  const utilisation = db.prepare("SELECT * FROM utilisations_code WHERE id = ? AND statut = 'en_attente'").get(req.params.id);
  if (!utilisation) return res.status(404).json({ error: 'Commande introuvable ou déjà traitée.' });

  db.prepare("UPDATE utilisations_code SET statut = 'confirmee', date_confirmation = CURRENT_TIMESTAMP WHERE id = ?")
    .run(utilisation.id);
  db.prepare('UPDATE collaborateurs SET gains_en_attente = gains_en_attente - ?, gains_confirmes = gains_confirmes + ? WHERE id = ?')
    .run(utilisation.montant_commission, utilisation.montant_commission, utilisation.collab_id);

  res.json({ message: 'Commission confirmée.' });
});

// PATCH /api/admin/commandes/:id/rejeter
router.patch('/commandes/:id/rejeter', authAdmin, (req, res) => {
  const utilisation = db.prepare("SELECT * FROM utilisations_code WHERE id = ? AND statut = 'en_attente'").get(req.params.id);
  if (!utilisation) return res.status(404).json({ error: 'Commande introuvable ou déjà traitée.' });

  db.prepare('DELETE FROM utilisations_code WHERE id = ?').run(utilisation.id);
  db.prepare('UPDATE collaborateurs SET gains_en_attente = gains_en_attente - ? WHERE id = ?')
    .run(utilisation.montant_commission, utilisation.collab_id);

  res.json({ message: 'Commande rejetée.' });
});

// ── Paiements ────────────────────────────────────────────────────────────────

// POST /api/admin/paiements
router.post('/paiements', authAdmin, (req, res) => {
  const { collab_id, montant, methode, reference, note } = req.body;
  if (!collab_id || !montant) return res.status(400).json({ error: 'Champs requis manquants.' });

  const collab = db.prepare('SELECT * FROM collaborateurs WHERE id = ?').get(collab_id);
  if (!collab) return res.status(404).json({ error: 'Collaborateur introuvable.' });

  const montantPaye = parseFloat(montant);
  if (montantPaye > collab.gains_confirmes)
    return res.status(400).json({ error: 'Montant supérieur aux gains confirmés.' });

  db.prepare('INSERT INTO paiements_collab (collab_id, montant, methode, reference, note) VALUES (?, ?, ?, ?, ?)')
    .run(collab_id, montantPaye, methode || '', reference || '', note || '');
  db.prepare('UPDATE collaborateurs SET gains_confirmes = gains_confirmes - ?, gains_payes = gains_payes + ? WHERE id = ?')
    .run(montantPaye, montantPaye, collab_id);

  res.json({ message: 'Paiement enregistré.' });
});

// GET /api/admin/collaborateurs-a-payer
router.get('/collaborateurs-a-payer', authAdmin, (req, res) => {
  const rows = db.prepare(
    'SELECT id, prenom, nom, code_promo, gains_confirmes, gains_payes FROM collaborateurs WHERE gains_confirmes > 0 ORDER BY gains_confirmes DESC'
  ).all();
  res.json(rows);
});

module.exports = router;
