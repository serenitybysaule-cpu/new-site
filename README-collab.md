# Système Collaborateurs — Serenity by Saule

## Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer les variables d'environnement
cp .env.example .env
# Puis éditer .env — le JWT_SECRET est déjà généré automatiquement

# 3. Initialiser la base de données
node server/db.js

# 4. (Optionnel) Insérer les données de test
node seed.js

# 5. Lancer le serveur
node server/index.js
# → http://localhost:3000
```

## Pages disponibles

| URL | Description |
|---|---|
| `/collab-login.html` | Connexion collaboratrice |
| `/collab-dashboard.html` | Espace privé collaboratrice |
| `/admin-login.html` | Connexion admin |
| `/admin.html` | Panel admin complet |

## Comptes de test

| Rôle | Email | Mot de passe | Code |
|---|---|---|---|
| Admin | admin@serenity.com | admin1234 | — |
| Collab 1 | marie@test.com | test1234 | MARIE15 |
| Collab 2 | fatima@test.com | test1234 | FATIMA10 |

## Intégration dans le formulaire de commande

Ajouter dans `shop.html` ou `index.html`, avant le bouton de confirmation :

```html
<div class="promo-field">
  <label>Code collaborateur (optionnel)</label>
  <div style="display:flex;gap:8px;">
    <input type="text" id="code-promo" placeholder="ex: MARIE15" style="text-transform:uppercase">
    <button type="button" onclick="verifierCode()">Appliquer</button>
  </div>
  <p id="promo-feedback" style="font-size:13px;margin-top:6px;"></p>
</div>

<script>
async function verifierCode() {
  const code = document.getElementById('code-promo').value.trim().toUpperCase();
  const feedback = document.getElementById('promo-feedback');
  if (!code) return;
  const res = await fetch(`/api/collab/verifier-code/${code}`);
  const data = await res.json();
  if (data.valide) {
    feedback.style.color = '#2d6a4f';
    feedback.textContent = `✓ Code valide ! Réduction de ${data.reduction_pct}% appliquée.`;
    window.codePromoValide = code;
    window.reductionAppliquee = data.reduction_pct;
  } else {
    feedback.style.color = '#c0392b';
    feedback.textContent = '✗ Code invalide ou inactif.';
    window.codePromoValide = null;
  }
}
</script>
```

## Déploiement production

Le serveur sert à la fois les fichiers statiques du site ET l'API. Il faut donc :
- Héberger sur un VPS ou service Node.js (Railway, Render, etc.)
- Pointer le domaine serenity-lingerie.com vers ce serveur (port 80/443 via nginx ou reverse proxy)
- Configurer `NODE_ENV=production` et un `JWT_SECRET` fort dans les variables d'environnement

## API — Routes principales

```
POST /api/auth/connexion           ← connexion collaboratrice
POST /api/auth/admin-connexion     ← connexion admin
GET  /api/collab/verifier-code/:code  ← vérifier un code (public)
GET  /api/collab/me                ← profil + stats (JWT collab)
GET  /api/collab/utilisations      ← historique (JWT collab)
GET  /api/admin/collaborateurs     ← liste collabs (JWT admin)
POST /api/admin/collaborateurs     ← créer collab (JWT admin)
POST /api/admin/commandes          ← enregistrer utilisation code (JWT admin)
PATCH /api/admin/commandes/:id/confirmer  ← confirmer commission (JWT admin)
PATCH /api/admin/commandes/:id/rejeter    ← rejeter commande (JWT admin)
POST /api/admin/paiements          ← marquer paiement (JWT admin)
```
