const express = require('express');
const db = require('../db');

const router = express.Router();

// POST /api/public/commande — appelé automatiquement depuis shop.html quand un code promo est utilisé
router.post('/commande', (req, res) => {
  const { code_promo, commande_ref, client_email, client_prenom, produit, prix_catalogue } = req.body;

  if (!code_promo || !commande_ref || !produit || !prix_catalogue)
    return res.status(400).json({ error: 'Champs requis manquants.' });

  const collab = db.prepare("SELECT * FROM collaborateurs WHERE code_promo = ? AND statut = 'actif'")
    .get(code_promo.toUpperCase().trim());

  if (!collab) return res.status(404).json({ error: 'Code promo invalide ou inactif.' });

  // Vérifier que cette ref de commande n'est pas déjà enregistrée
  const existing = db.prepare('SELECT id FROM utilisations_code WHERE commande_ref = ?').get(commande_ref);
  if (existing) return res.json({ message: 'Commande déjà enregistrée.', id: existing.id });

  const prix = parseFloat(prix_catalogue);
  const montant_reduction   = parseFloat((prix * collab.reduction_client).toFixed(2));
  const prix_paye           = parseFloat((prix - montant_reduction).toFixed(2));
  const montant_commission  = parseFloat((prix_paye * collab.taux_commission).toFixed(2));

  const result = db.prepare(`
    INSERT INTO utilisations_code
      (collab_id, commande_ref, client_email, client_prenom, produit, prix_catalogue, montant_reduction, prix_paye, montant_commission)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(collab.id, commande_ref.trim(), client_email || '', client_prenom || '',
         produit.trim(), prix, montant_reduction, prix_paye, montant_commission);

  db.prepare('UPDATE collaborateurs SET gains_en_attente = gains_en_attente + ? WHERE id = ?')
    .run(montant_commission, collab.id);

  res.status(201).json({
    message: 'Commande enregistrée, en attente de confirmation.',
    id: result.lastInsertRowid,
    montant_commission,
    collab_prenom: collab.prenom,
  });
});

module.exports = router;
