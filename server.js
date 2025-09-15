const express = require("express");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let lists = {};

// Pagina home
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Creazione lista (ora da form HTML, non fetch)
app.post("/create", (req, res) => {
  const { items } = req.body;
  if (!items) {
    return res.send("<h1>Errore: nessun elemento inserito.</h1>");
  }

  const itemArray = items.split(",").map(i => i.trim()).filter(i => i.length > 0);
  if (itemArray.length === 0) {
    return res.send("<h1>Errore: lista vuota.</h1>");
  }

  const id = uuidv4();
  lists[id] = { items: itemArray, assigned: [] };

  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const joinUrl = `${baseUrl}/join/${id}`;
  const statusUrl = `${baseUrl}/status/${id}`;

  res.send(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <title>Lista creata</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 2em; }
        .box { padding: 1em; border: 1px solid #ccc; border-radius: 8px; margin-top: 1em; }
        a { display: block; margin-top: 0.5em; font-size: 1.2em; }
      </style>
    </head>
    <body>
      <h1>✅ Lista creata!</h1>
      <div class="box">
        <p><strong>Link da condividere:</strong></p>
        <a href="${joinUrl}">${joinUrl}</a>
        <p><strong>Link stato:</strong></p>
        <a href="${statusUrl}">${statusUrl}</a>
      </div>
    </body>
    </html>
  `);
});

// Assegna un elemento
app.get("/join/:listId", (req, res) => {
  const { listId } = req.params;
  const list = lists[listId];
  if (!list) return res.status(404).send("Lista non trovata.");

  if (list.items.length === 0) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="it">
      <head><meta charset="UTF-8"><title>Lista esaurita</title></head>
      <body><h1>⚠️ Tutti gli elementi sono già stati assegnati.</h1></body>
      </html>
    `);
  }

  const item = list.items.shift();
  list.assigned.push(item);

  res.send(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <title>Il tuo elemento</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 5em; }
        .item { font-size: 2em; font-weight: bold; color: #333; padding: 1em; border: 2px solid #333; display: inline-block; border-radius: 10px; }
      </style>
    </head>
    <body>
      <h1>🎁 Ecco il tuo elemento:</h1>
      <div class="item">${item}</div>
    </body>
    </html>
  `);
});

// Stato lista
app.get("/status/:listId", (req, res) => {
  const { listId } = req.params;
  const list = lists[listId];
  if (!list) return res.status(404).send("Lista non trovata.");

  res.send(`
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <title>Stato lista</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 2em; }
        ul { list-style: none; padding: 0; }
        li { padding: 0.5em; border-bottom: 1px solid #ccc; }
        h2 { margin-top: 1.5em; }
      </style>
    </head>
    <body>
      <h1>📋 Stato della lista</h1>
      <h2>Assegnati:</h2>
      <ul>${list.assigned.map(i => `<li>${i}</li>`).join("")}</ul>
      <h2>Disponibili:</h2>
      <ul>${list.items.map(i => `<li>${i}</li>`).join("")}</ul>
    </body>
    </html>
  `);
});

app.listen(port, () => {
  console.log(`Server avviato su http://localhost:${port}`);
});
