// server.js
const express = require('express');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// DB in memoria (semplice). Se vuoi persistenza dopo, poi lo sostituiamo con DB esterno.
const db = {};

/* CREATE LIST: riceve { title?, items: ["a","b",...] } */
app.post('/create-list', (req, res) => {
  const { title, items } = req.body;
  // normalizza: items può arrivare come stringa o array
  let itemsArray = [];
  if (Array.isArray(items)) itemsArray = items;
  else if (typeof items === 'string') itemsArray = items.split(',').map(s => s.trim()).filter(Boolean);

  if (!itemsArray || itemsArray.length === 0) {
    return res.status(400).json({ error: 'items array required' });
  }

  const listId = uuidv4();
  db[listId] = {
    title: title || '',
    items: itemsArray.slice(),
    assigned: {} // cookieId -> item
  };

  // ritorniamo path; il frontend costruirà l'URL completo usando window.location.origin
  res.json({
    id: listId,
    shareUrl: `/join/${listId}`,
    statusUrl: `/status-page/${listId}`
  });
});

/* JOIN: assegna un elemento unico e salva cookie */
app.get('/join/:listId', (req, res) => {
  const listId = req.params.listId;
  const list = db[listId];
  if (!list) return res.status(404).send('Lista non trovata');

  const cookieKey = `assign_${listId}`;
  const existingCookie = req.cookies && req.cookies[cookieKey];

  // se cookie già presente e assegnaato, restituisci stesso elemento
  if (existingCookie && list.assigned[existingCookie]) {
    return res.json({ item: list.assigned[existingCookie] });
  }

  const assignedValues = Object.values(list.assigned);
  const available = list.items.filter(i => !assignedValues.includes(i));
  if (available.length === 0) return res.status(410).send('Nessun elemento disponibile');

  const pick = available[Math.floor(Math.random() * available.length)];
  const cookieId = existingCookie || uuidv4();
  list.assigned[cookieId] = pick;

  // setta cookie (1 anno)
  res.cookie(cookieKey, cookieId, { maxAge: 1000 * 60 * 60 * 24 * 365, httpOnly: true });
  res.json({ item: pick });
});

/* API status (JSON) - utile per debug o integrazioni */
app.get('/status/:listId', (req, res) => {
  const listId = req.params.listId;
  const list = db[listId];
  if (!list) return res.status(404).json({ error: 'not-found' });
  const total = list.items.length;
  const assignedCount = Object.keys(list.assigned).length;
  res.json({ id: listId, title: list.title, total, assignedCount, remaining: total - assignedCount, assignments: list.assigned });
});

/* STATUS PAGE: pagina leggibile per l'utente che gestisce la lista */
app.get('/status-page/:listId', (req, res) => {
  const listId = req.params.listId;
  const list = db[listId];
  if (!list) {
    return res.status(404).send('<h2>Lista non trovata</h2>');
  }

  const assignedEntries = Object.entries(list.assigned).map(([cookie, item]) => `<li><code>${cookie.slice(0,8)}...</code> → ${escapeHtml(item)}</li>`).join('') || '<li>Nessuno</li>';
  const assignedValues = Object.values(list.assigned);
  const available = list.items.filter(i => !assignedValues.includes(i)).map(i => `<li>${escapeHtml(i)}</li>`).join('') || '<li>Nessuno</li>';

  // link completo per condivisione
  const origin = req.protocol + '://' + req.get('host');
  const shareFull = `${origin}/join/${listId}`;

  res.send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>Status lista ${escapeHtml(list.title || listId)}</title>
        <style>
          body{font-family:system-ui,Arial;max-width:900px;margin:18px auto;padding:10px}
          pre{background:#f5f5f5;padding:8px;border-radius:6px}
          textarea{width:100%;height:80px}
          button{padding:8px 12px;margin-top:8px}
        </style>
      </head>
      <body>
        <h1>Status: ${escapeHtml(list.title || '(senza titolo)')}</h1>
        <p><b>Link da condividere:</b> <a href="${shareFull}" target="_blank">${shareFull}</a></p>

        <h2>Assegnati (${Object.keys(list.assigned).length})</h2>
        <ul>${assignedEntries}</ul>

        <h2>Disponibili</h2>
        <ul>${available}</ul>

        <form method="POST" action="/reset/${listId}" onsubmit="return confirm('Sei sicuro di voler resettare la lista? Tutte le assegnazioni verranno rimosse.');">
          <button type="submit">🔄 Reset lista</button>
        </form>

        <h3>Modifica la lista</h3>
        <form method="POST" action="/update/${listId}">
          <label>Elementi (separati da virgola):</label><br>
          <textarea name="items">${list.items.map(i=>escapeHtml(i)).join(', ')}</textarea><br>
          <button type="submit">💾 Aggiorna lista (azzerando assegnazioni)</button>
        </form>

        <p><small>Nota: chi ha il link può visualizzare e resettare la lista.</small></p>
      </body>
    </html>
  `);
});

/* Reset: azzera assegnazioni */
app.post('/reset/:listId', (req, res) => {
  const listId = req.params.listId;
  const list = db[listId];
  if (!list) return res.status(404).send('Lista non trovata');
  list.assigned = {};
  res.redirect(`/status-page/${listId}`);
});

/* Update: sostituisce gli elementi e azzera assegnazioni (form urlencoded) */
app.post('/update/:listId', (req, res) => {
  const listId = req.params.listId;
  const list = db[listId];
  if (!list) return res.status(404).send('Lista non trovata');
  const itemsRaw = req.body.items || '';
  const itemsArray = itemsRaw.split(',').map(s => s.trim()).filter(Boolean);
  if (itemsArray.length === 0) return res.send('Inserisci almeno un elemento.');
  list.items = itemsArray;
  list.assigned = {};
  res.redirect(`/status-page/${listId}`);
});

/* fallback - 404 */
app.use((req, res) => {
  res.status(404).send('Not found');
});

/* helper per sicurezza XSS minima */
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
}

app.listen(PORT, () => console.log(`Server avviato su http://localhost:${PORT}`));
