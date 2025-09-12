
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

let lists = {};

app.post('/create', (req, res) => {
  const { title, items } = req.body;
  const id = uuidv4();
  const itemsArray = items.split(',').map(s => s.trim()).filter(Boolean);
  lists[id] = {
    title,
    original: [...itemsArray],
    remaining: [...itemsArray],
    assigned: {},
  };
  res.json({ joinUrl: `/join/${id}`, statusUrl: `/status/${id}` });
});

app.get('/join/:id', (req, res) => {
  const list = lists[req.params.id];
  if (!list) return res.send("Lista non trovata");
  if (list.remaining.length === 0) return res.send("Nessun elemento disponibile");
  const item = list.remaining.shift();
  const userId = uuidv4();
  list.assigned[userId] = item;
  res.send(`Ti è stato assegnato: <b>${item}</b>`);
});

app.get('/status/:id', (req, res) => {
  const list = lists[req.params.id];
  if (!list) return res.send("Lista non trovata");
  res.send(`
    <h1>Status lista: ${list.title}</h1>
    <p>Assegnati: ${Object.values(list.assigned).join(', ') || 'Nessuno'}</p>
    <p>Disponibili: ${list.remaining.join(', ') || 'Nessuno'}</p>
    <form method="POST" action="/reset/${req.params.id}">
      <button type="submit">🔄 Reset lista</button>
    </form>
    <h2>Modifica lista</h2>
    <form method="POST" action="/update/${req.params.id}">
      <textarea name="items" rows="5" cols="40">${list.original.join(', ')}</textarea><br>
      <button type="submit">💾 Aggiorna</button>
    </form>
  `);
});

app.post('/reset/:id', (req, res) => {
  const list = lists[req.params.id];
  if (!list) return res.send("Lista non trovata");
  list.remaining = [...list.original];
  list.assigned = {};
  res.redirect(`/status/${req.params.id}`);
});

app.post('/update/:id', (req, res) => {
  const list = lists[req.params.id];
  if (!list) return res.send("Lista non trovata");
  const itemsArray = req.body.items.split(',').map(s => s.trim()).filter(Boolean);
  list.original = [...itemsArray];
  list.remaining = [...itemsArray];
  list.assigned = {};
  res.redirect(`/status/${req.params.id}`);
});

app.listen(port, () => {
  console.log(`Server in ascolto su http://localhost:${port}`);
});
