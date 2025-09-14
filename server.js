const express = require('express');
const cookieParser = require('cookie-parser');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: set SUPABASE_URL and SUPABASE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// funzione per assicurarsi che le tabelle esistano
async function ensureTables() {
  await supabase.rpc('pg_query', {
    query: `
      CREATE TABLE IF NOT EXISTS lists (
        id uuid PRIMARY KEY,
        title text
      );
      CREATE TABLE IF NOT EXISTS items (
        id uuid PRIMARY KEY,
        list_id uuid REFERENCES lists(id),
        value text,
        assigned boolean DEFAULT false
      );
      CREATE TABLE IF NOT EXISTS assignments (
        id uuid PRIMARY KEY,
        list_id uuid REFERENCES lists(id),
        item_id uuid REFERENCES items(id),
        cookie_id text
      );
    `
  });
}

// chiama la scrittura iniziale (potresti farla al primo start)
ensureTables().catch(err => console.error('Error ensuring tables', err));

// Crea lista
app.post('/create-list', async (req, res) => {
  const { title, items } = req.body || {};
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items array required' });
  }
  const listId = uuidv4();
  await supabase
    .from('lists')
    .insert({ id: listId, title: title || null });
  for (const v of items) {
    await supabase
      .from('items')
      .insert({ id: uuidv4(), list_id: listId, value: v, assigned: false });
  }
  res.json({ id: listId, joinUrl: `/join/${listId}`, statusUrl: `/status/${listId}` });
});

// Join
app.get('/join/:listId', async (req, res) => {
  const listId = req.params.listId;
  const cookieKey = `assign_${listId}`;
  const existingCookie = req.cookies && req.cookies[cookieKey];
  if (existingCookie) {
    const { data: existingAssign } = await supabase
      .from('assignments')
      .select('item_id')
      .eq('list_id', listId)
      .eq('cookie_id', existingCookie)
      .limit(1);
    if (existingAssign && existingAssign.length > 0) {
      const itemId = existingAssign[0].item_id;
      const { data: itemRow } = await supabase
        .from('items')
        .select('value')
        .eq('id', itemId)
        .single();
      return res.json({ item: itemRow.value });
    }
  }
  // prendi un item non assegnato
  const { data: freeItems } = await supabase
    .from('items')
    .select('id, value')
    .eq('list_id', listId)
    .eq('assigned', false)
    .limit(1);
  if (!freeItems || freeItems.length === 0) {
    return res.status(410).send('Nessun elemento disponibile');
  }
  const item = freeItems[0];

  // aggiorna item come assegnato
  await supabase
    .from('items')
    .update({ assigned: true })
    .eq('id', item.id);

  const cookieId = existingCookie || uuidv4();
  await supabase
    .from('assignments')
    .insert({ id: uuidv4(), list_id: listId, item_id: item.id, cookie_id: cookieId });

  res.cookie(cookieKey, cookieId, { maxAge: 1000*60*60*24*365, httpOnly: true });
  res.json({ item: item.value });
});

// Status
app.get('/status/:listId', async (req, res) => {
  const listId = req.params.listId;
  const { count: total } = await supabase
    .from('items')
    .select('*')
    .eq('list_id', listId);
  const { count: assigned } = await supabase
    .from('items')
    .select('*')
    .eq('list_id', listId)
    .eq('assigned', true);
  res.json({ total, assigned, remaining: total - assigned });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server listening on port', PORT));
