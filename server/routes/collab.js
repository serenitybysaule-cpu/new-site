const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

// Middleware JWT collab
function authCollab(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Token manquant.' });
  try {
    const payload = jwt.verify(header.replace('Bearer ', ''), process.env.JWT_SECRET);
    if (payload.role !== 'collab') throw new Error();
    req.collabId = payload.id;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré.' });
  }
}

// GET /api/collab/verifier-code/:code — public
router.get('/verifier-code/:code', (req, res) => {
  const code = req.params.code.toUpperCase().trim();
  const collab = db
    .prepare("SELECT reduction_client FROM collaborateurs WHERE code_promo = ? AND statut = 'actif'")
    .get(code);

  if (!collab) return res.json({ valide: false });
  res.json({ valide: true, reduction_pct: Math.round(collab.reduction_client * 100) });
});

// GET /api/collab/me
router.get('/me', authCollab, (req, res) => {
  const collab = db.prepare('SELECT * FROM collaborateurs WHERE id = ?').get(req.collabId);
  if (!collab) return res.status(404).json({ error: 'Introuvable.' });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const stats = db.prepare(`
    SELECT
      COUNT(*) AS utilisations_total,
      SUM(CASE WHEN date_utilisation >= ? THEN 1 ELSE 0 END) AS utilisations_mois
    FROM utilisations_code WHERE collab_id = ?
  `).get(startOfMonth, collab.id);

  res.json({
    prenom: collab.prenom,
    nom: collab.nom,
    code_promo: collab.code_promo,
    reduction_client: collab.reduction_client,
    taux_commission: collab.taux_commission,
    statut: collab.statut,
    date_creation: collab.date_creation,
    stats: {
      utilisations_total: stats.utilisations_total || 0,
      utilisations_mois: stats.utilisations_mois || 0,
      gains_en_attente: collab.gains_en_attente,
      gains_confirmes: collab.gains_confirmes,
      gains_payes: collab.gains_payes,
    },
  });
});

// GET /api/collab/utilisations
router.get('/utilisations', authCollab, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  const total = db.prepare('SELECT COUNT(*) AS n FROM utilisations_code WHERE collab_id = ?').get(req.collabId).n;
  const rows = db.prepare(
    'SELECT * FROM utilisations_code WHERE collab_id = ? ORDER BY date_utilisation DESC LIMIT ? OFFSET ?'
  ).all(req.collabId, limit, offset);

  res.json({ total, page, limit, data: rows });
});

module.exports = router;
