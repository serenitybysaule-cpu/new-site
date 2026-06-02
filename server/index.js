require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Servir les fichiers statiques du site (HTML, CSS, assets)
app.use(express.static(path.join(__dirname, '..')));

// Routes API
app.use('/api/auth',  require('./routes/auth'));
app.use('/api/collab', require('./routes/collab'));
app.use('/api/admin',  require('./routes/admin'));

// Fallback 404 pour les routes inconnues
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Route introuvable.' });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`✅ Serenity Collab Server → http://localhost:${PORT}`);
});
