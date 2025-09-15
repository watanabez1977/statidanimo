const express = require("express");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Memoria in RAM (non persistente)
const db = {};

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ✅ Route per creare una nuova lista
app.post("/create-list", (req, res) => {
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Devi fornire una lista di elementi" });
  }

  const listId = uuidv4();
  db[listId] = { items, assigned: {} };

  res.json({
    shareUrl: `/join/${listId}`,
    statusUrl: `/status/${listId}`
  });
});

// ✅ Route per unirsi a una lista
app.get("/join/:listId", (req, res) => {
  const { listId } = req.params;
  const list = db[listId];

  if (!list) {
    return res.status(404).send("Lista non trovata");
  }

  const available = list.items.filter(
    item => !Object.values(list.assigned).includes(item)
  );

  if (available.length === 0) {
    return res.status(410).send("Tutti gli elementi sono già stati assegnati");
  }

  const item = available[Math.floor(Math.random() * available.length)];
  const userId = uuidv4();
  list.assigned[userId] = item;

  res.send(`Ti è stato assegnato: <b>${item}</b>`);
});

// ✅ Route per controllare lo stato di una lista
app.get("/status/:listId", (req, res) => {
  const { listId } = req.params;
  const list = db[listId];

  if (!list) {
    return res.status(404).send("Lista non trovata");
  }

  res.json(list);
});

// Avvio server
app.listen(PORT, () => {
  console.log(`Server avviato su http://localhost:${PORT}`);
});
