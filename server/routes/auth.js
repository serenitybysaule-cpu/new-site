const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

const router = express.Router();

// POST /api/auth/inscription — auto-inscription collaboratrice
router.post('/inscription', (req, res) => {
  const { prenom, nom, email, password, telephone, instagram, message_inscription } = req.body;
  if (!prenom || !nom || !email || !password)
    return res.status(400).json({ error: 'Prénom, nom, email et mot de passe sont requis.' });
  if (password.length < 8)
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 8 caractères.' });

  const existing = db.prepare('SELECT id FROM collaborateurs WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) return res.status(409).json({ error: 'Cette adresse email est déjà utilisée.' });

  const hash = bcrypt.hashSync(password, 12);
  const placeholder = 'PENDING-' + Date.now();
  db.prepare(`
    INSERT INTO collaborateurs (prenom, nom, email, password_hash, telephone, instagram, message_inscription, statut, code_promo, taux_commission, reduction_client)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'en_attente', ?, 0, 0)
  `).run(prenom.trim(), nom.trim(), email.toLowerCase().trim(), hash,
         telephone || '', instagram || '', message_inscription || '', placeholder);

  res.status(201).json({ message: 'Votre demande a été envoyée. Vous serez contactée dès validation de votre compte.' });
});

// POST /api/auth/connexion — collaborateur
router.post('/connexion', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis.' });

  const collab = db.prepare('SELECT * FROM collaborateurs WHERE email = ?').get(email.toLowerCase().trim());
  if (!collab)
    return res.status(401).json({ error: 'Identifiants invalides.' });
  if (collab.statut === 'en_attente')
    return res.status(403).json({ error: 'Votre compte est en attente de validation par Serenity. Vous serez contactée par email.' });
  if (collab.statut === 'suspendu')
    return res.status(403).json({ error: 'Votre compte est suspendu. Contactez info@serenity-lingerie.com.' });

  const ok = bcrypt.compareSync(password, collab.password_hash);
  if (!ok) return res.status(401).json({ error: 'Identifiants invalides.' });

  const token = jwt.sign(
    { id: collab.id, role: 'collab' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: collab.id,
      prenom: collab.prenom,
      code_promo: collab.code_promo,
      taux_commission: collab.taux_commission,
      reduction_client: collab.reduction_client,
    },
  });
});

// POST /api/auth/admin-connexion
router.post('/admin-connexion', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email et mot de passe requis.' });

  const admin = db.prepare('SELECT * FROM admin WHERE email = ?').get(email.toLowerCase().trim());
  if (!admin) return res.status(401).json({ error: 'Identifiants invalides.' });

  const ok = bcrypt.compareSync(password, admin.password_hash);
  if (!ok) return res.status(401).json({ error: 'Identifiants invalides.' });

  const token = jwt.sign(
    { id: admin.id, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { id: admin.id, email: admin.email, role: 'admin' } });
});

module.exports = router;
