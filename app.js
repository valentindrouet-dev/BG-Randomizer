'use strict';

/* =========================================================
   Roulette à jeux — choisit un jeu de société dans ta
   collection BoardGameGeek selon quelques critères.
   ========================================================= */

const $ = (sel) => document.querySelector(sel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const KEYS = {
  settings: 'bgr.settings',
  library: 'bgr.library',
  filters: 'bgr.filters',
  localPlays: 'bgr.localPlays',
};

const RECENT_DAYS = 30;
const WHEEL_SLOTS = 12;
const PLAYS_MAX_PAGES = 5;

const COLORS = [
  { bg: '#ff8a1f', fg: '#0d2a1c' },
  { bg: '#2e9d5b', fg: '#ffffff' },
  { bg: '#ffd3a8', fg: '#0d2a1c' },
  { bg: '#a8e6bd', fg: '#0d2a1c' },
];

/* ---------- Stockage ---------- */

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* stockage indisponible : on continue sans */
  }
}

const state = {
  settings: load(KEYS.settings, { user: '', proxy: '', token: '' }),
  library: load(KEYS.library, null), // { games, syncedAt, source }
  filters: load(KEYS.filters, {}),
  localPlays: load(KEYS.localPlays, {}),
  wheel: [],
  rotation: 0,
  spinning: false,
  picks: null,
};

/* ---------- Dates ---------- */

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr + 'T12:00:00');
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function daysAgoStr(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

/* ---------- Jeux ---------- */

function games() {
  const list = state.library?.games || [];
  return list.map((g) => {
    const local = state.localPlays[g.id];
    if (!local) return g;
    const last = !g.lastPlayed || local.date > g.lastPlayed ? local.date : g.lastPlayed;
    return { ...g, lastPlayed: last, numPlays: (g.numPlays || 0) + local.count };
  });
}

function playTime(g) {
  return g.time || 0;
}

const FILTERS = {
  players(g, v) {
    const n = Number(v);
    if (!g.minP || !g.maxP) return false;
    return n >= 6 ? g.maxP >= 6 : g.minP <= n && n <= g.maxP;
  },
  duration(g, v) {
    const t = playTime(g);
    if (!t) return false;
    if (v === 'short') return t <= 30;
    if (v === 'mid') return t > 30 && t <= 60;
    if (v === 'long') return t > 60 && t <= 120;
    return t > 120;
  },
  recent(g, v) {
    const d = daysSince(g.lastPlayed);
    if (v === 'recent') return d <= RECENT_DAYS;
    if (v === 'old') return d > RECENT_DAYS;
    return !g.lastPlayed && !g.numPlays;
  },
  weight(g, v) {
    const w = g.weight || 0;
    if (!w) return false;
    if (v === 'light') return w < 2;
    if (v === 'medium') return w >= 2 && w <= 3;
    return w > 3;
  },
  style(g, values) {
    if (!values.length) return true;
    return values.some((s) => (g.styles || []).includes(s));
  },
};

function pool() {
  const f = state.filters;
  return games().filter((g) =>
    Object.entries(f).every(([key, v]) => {
      if (v == null || (Array.isArray(v) && !v.length)) return true;
      return FILTERS[key](g, v);
    })
  );
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- Roue ---------- */

const canvas = $('#wheel');
const ctx = canvas.getContext('2d');

function segColor(i, n) {
  let c = i % COLORS.length;
  // évite deux couleurs identiques côte à côte au raccord
  if (i === n - 1 && n > 1 && c === 0) c = 2;
  return COLORS[c];
}

function shortName(name, max) {
  const clean = name.replace(/\s*[:(–-].*$/, '').trim() || name;
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

function drawWheel() {
  const size = canvas.width;
  const r = size / 2;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(r, r);

  const items = state.wheel.length ? state.wheel : Array(8).fill({ name: '?' });
  const n = items.length;
  const seg = (Math.PI * 2) / n;

  items.forEach((g, i) => {
    const start = -Math.PI / 2 + state.rotation + i * seg;
    const col = segColor(i, n);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r - 6, start, start + seg);
    ctx.closePath();
    ctx.fillStyle = col.bg;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#123f2a';
    ctx.stroke();

    ctx.save();
    ctx.rotate(start + seg / 2);
    ctx.fillStyle = col.fg;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const fontSize = n <= 6 ? 34 : n <= 9 ? 30 : 26;
    ctx.font = `800 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(g.name === '?' ? '?' : shortName(g.name, 13), r - 28, 0);
    ctx.restore();
  });

  // bord + moyeu
  ctx.beginPath();
  ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#ff8a1f';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 46, 0, Math.PI * 2);
  ctx.fillStyle = '#123f2a';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ff8a1f';
  ctx.stroke();
  ctx.fillStyle = '#ff8a1f';
  ctx.font = '900 40px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎲', 0, 3);

  ctx.restore();
}

function fillWheel(winner) {
  const others = shuffle(pool().filter((g) => !winner || g.id !== winner.id));
  const slots = others.slice(0, winner ? WHEEL_SLOTS - 1 : WHEEL_SLOTS);
  state.wheel = winner ? shuffle([...slots, winner]) : slots;
}

function spin() {
  if (state.spinning) return;
  if (!state.library) {
    openSettings();
    return;
  }
  const candidates = pool();
  if (!candidates.length) return;

  const shuffled = shuffle(candidates);
  const first = shuffled[0];
  const second = shuffled[1] || null;

  fillWheel(first);
  const n = state.wheel.length;
  const seg = (Math.PI * 2) / n;
  const idx = state.wheel.indexOf(first);

  // angle final : le segment gagnant au centre du pointeur (en haut)
  const jitter = (Math.random() - 0.5) * seg * 0.6;
  const target = -((idx + 0.5) * seg + jitter);
  const TAU = Math.PI * 2;
  const cur = state.rotation;
  const delta = ((target - cur) % TAU + TAU) % TAU;
  const end = cur + TAU * 6 + delta;

  const duration = 4200;
  const t0 = performance.now();
  state.spinning = true;
  $('#btn-spin').disabled = true;
  $('#result').hidden = true;

  const easeOut = (t) => 1 - Math.pow(1 - t, 4);

  function frame(now) {
    const t = Math.min(1, (now - t0) / duration);
    state.rotation = cur + (end - cur) * easeOut(t);
    drawWheel();
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      state.rotation = end % TAU;
      state.spinning = false;
      $('#btn-spin').disabled = false;
      showResult(first, second);
    }
  }
  requestAnimationFrame(frame);
}

/* ---------- Résultat ---------- */

function metaLine(g) {
  const parts = [];
  if (g.minP && g.maxP) parts.push(`👥 ${g.minP === g.maxP ? g.minP : g.minP + '–' + g.maxP}`);
  if (playTime(g)) parts.push(`⏱️ ${playTime(g)}′`);
  const d = daysSince(g.lastPlayed);
  if (d === Infinity) parts.push('✨ Jamais joué');
  else if (d === 0) parts.push("📅 Aujourd'hui");
  else parts.push(`📅 ${d} j`);
  return parts.join('   ');
}

function setPick(prefix, g) {
  $(`#${prefix}-name`).textContent = g.name;
  $(`#${prefix}-meta`).textContent = metaLine(g);
  const img = $(`#${prefix}-img`);
  if (g.image || g.thumb) img.src = prefix === 'r1' ? g.image || g.thumb : g.thumb || g.image;
  else img.removeAttribute('src');
}

function showResult(first, second) {
  state.picks = { first, second };
  setPick('r1', first);
  const p2 = $('.pick-2');
  if (second) {
    setPick('r2', second);
    p2.hidden = false;
  } else {
    p2.hidden = true;
  }
  const play = $('#btn-play');
  play.disabled = false;
  play.textContent = '✅ On y joue !';
  const res = $('#result');
  res.hidden = false;
  res.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function markPlayed() {
  const g = state.picks?.first;
  if (!g) return;
  const prev = state.localPlays[g.id] || { count: 0 };
  state.localPlays[g.id] = { date: today(), count: prev.count + 1 };
  save(KEYS.localPlays, state.localPlays);
  const play = $('#btn-play');
  play.disabled = true;
  play.textContent = '🎉 Bonne partie !';
  refresh();
}

/* ---------- Filtres UI ---------- */

function renderFilters() {
  const all = games();
  const hasWeight = all.some((g) => g.weight);
  const hasStyles = all.some((g) => g.styles && g.styles.length);

  document.querySelectorAll('.chips').forEach((group) => {
    const key = group.dataset.filter;
    const val = state.filters[key];
    const disabled = (key === 'weight' && !hasWeight) || (key === 'style' && !hasStyles);
    group.querySelectorAll('button').forEach((b) => {
      const on = Array.isArray(val) ? val.includes(b.dataset.v) : val === b.dataset.v;
      b.classList.toggle('on', on && !disabled);
      b.disabled = disabled && all.length > 0;
    });
  });
}

function onChip(e) {
  const btn = e.target.closest('button');
  if (!btn || state.spinning) return;
  const group = btn.closest('.chips');
  const key = group.dataset.filter;
  const v = btn.dataset.v;

  if (group.dataset.multi) {
    const cur = new Set(state.filters[key] || []);
    cur.has(v) ? cur.delete(v) : cur.add(v);
    state.filters[key] = [...cur];
  } else {
    state.filters[key] = state.filters[key] === v ? null : v;
  }
  save(KEYS.filters, state.filters);
  refresh();
}

function refresh() {
  renderFilters();
  const n = pool().length;
  const count = $('#pool-count');
  const btn = $('#btn-spin');
  if (!state.library) {
    count.textContent = '⚙️ Ajoute ton pseudo BGG';
    btn.textContent = 'COMMENCER';
    btn.disabled = false;
  } else if (!n) {
    count.textContent = 'Aucun jeu 😢';
    btn.textContent = 'LANCER';
    btn.disabled = true;
  } else {
    count.textContent = `${n} jeu${n > 1 ? 'x' : ''}`;
    btn.textContent = 'LANCER';
    btn.disabled = state.spinning;
  }
  if (!state.spinning) {
    fillWheel(null);
    drawWheel();
  }
}

/* ---------- BoardGameGeek ---------- */

class BggError extends Error {}

async function bgg(path, params) {
  const { proxy, token } = state.settings;
  const base = proxy ? proxy.replace(/\/+$/, '') : 'https://boardgamegeek.com';
  const url = `${base}/xmlapi2/${path}?${new URLSearchParams(params)}`;
  const headers = {};
  if (!proxy && token) headers.Authorization = `Bearer ${token}`;

  for (let attempt = 0; attempt < 8; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers });
    } catch {
      throw new BggError('🚧 Connexion bloquée. Ajoute un proxy dans 🔑');
    }
    // 202 = BGG prépare la collection ; 429 = trop de requêtes
    if (res.status === 202 || res.status === 429 || res.status >= 500) {
      await sleep(Math.min(2500 * (attempt + 1), 10000));
      continue;
    }
    if (res.status === 401 || res.status === 403) throw new BggError('🔑 Accès refusé : vérifie le jeton');
    if (!res.ok) throw new BggError(`😵 Erreur BGG ${res.status}`);

    const doc = new DOMParser().parseFromString(await res.text(), 'application/xml');
    if (doc.querySelector('parsererror')) throw new BggError('😵 Réponse BGG illisible');
    const msg = doc.querySelector('error message, error');
    if (msg) {
      const text = msg.textContent.trim();
      if (/invalid username/i.test(text)) throw new BggError('🤷 Pseudo inconnu');
      throw new BggError('😵 ' + text);
    }
    return doc;
  }
  throw new BggError('⏳ BGG est occupé, réessaie');
}

const intAttr = (el, sel, attr = 'value') => {
  const node = sel ? el.querySelector(sel) : el;
  return node ? parseInt(node.getAttribute(attr), 10) || 0 : 0;
};

async function fetchCollection(user) {
  const doc = await bgg('collection', {
    username: user,
    own: 1,
    stats: 1,
    subtype: 'boardgame',
    excludesubtype: 'boardgameexpansion',
  });
  const byId = new Map();
  doc.querySelectorAll('items > item').forEach((it) => {
    const id = it.getAttribute('objectid');
    if (byId.has(id)) return;
    const stats = it.querySelector('stats');
    const time = stats
      ? intAttr(stats, null, 'playingtime') || intAttr(stats, null, 'maxplaytime') || intAttr(stats, null, 'minplaytime')
      : 0;
    byId.set(id, {
      id,
      name: it.querySelector('name')?.textContent.trim() || '?',
      thumb: it.querySelector('thumbnail')?.textContent.trim() || '',
      image: it.querySelector('image')?.textContent.trim() || '',
      minP: stats ? intAttr(stats, null, 'minplayers') : 0,
      maxP: stats ? intAttr(stats, null, 'maxplayers') : 0,
      time,
      numPlays: parseInt(it.querySelector('numplays')?.textContent, 10) || 0,
      weight: 0,
      styles: [],
      lastPlayed: null,
    });
  });
  return byId;
}

// Familles de classement BGG + catégories/mécaniques → styles simples
const RANK_STYLES = {
  strategygames: 'strategy',
  familygames: 'family',
  partygames: 'party',
  thematic: 'thematic',
  abstracts: 'abstract',
  childrensgames: 'kids',
};
const LINK_STYLES = {
  2023: 'coop', // Cooperative Game (mécanique)
  1002: 'cards', // Card Game
  1030: 'party', // Party Game
  1009: 'abstract', // Abstract Strategy
  1041: 'kids', // Children's Game
};

async function fetchDetails(byId, onProgress) {
  const ids = [...byId.keys()];
  const CHUNK = 20;
  const total = Math.ceil(ids.length / CHUNK);
  for (let i = 0; i < ids.length; i += CHUNK) {
    onProgress(`🔍 Détails ${i / CHUNK + 1}/${total}`);
    const doc = await bgg('thing', { id: ids.slice(i, i + CHUNK).join(','), stats: 1 });
    doc.querySelectorAll('items > item').forEach((it) => {
      const g = byId.get(it.getAttribute('id'));
      if (!g) return;
      const styles = new Set();
      it.querySelectorAll('ranks rank[type="family"]').forEach((r) => {
        const s = RANK_STYLES[r.getAttribute('name')];
        if (s) styles.add(s);
      });
      it.querySelectorAll('link[type="boardgamecategory"], link[type="boardgamemechanic"]').forEach((l) => {
        const s = LINK_STYLES[l.getAttribute('id')];
        if (s) styles.add(s);
      });
      g.styles = [...styles];
      g.weight = parseFloat(it.querySelector('averageweight')?.getAttribute('value')) || 0;
      g.minP ||= intAttr(it, 'minplayers');
      g.maxP ||= intAttr(it, 'maxplayers');
      g.time ||= intAttr(it, 'playingtime') || intAttr(it, 'maxplaytime');
      if (!g.thumb) g.thumb = it.querySelector('thumbnail')?.textContent.trim() || '';
      if (!g.image) g.image = it.querySelector('image')?.textContent.trim() || '';
    });
    if (i + CHUNK < ids.length) await sleep(1200);
  }
}

async function fetchPlays(user, byId, onProgress) {
  for (let page = 1; page <= PLAYS_MAX_PAGES; page++) {
    onProgress(`📅 Parties ${page}…`);
    const doc = await bgg('plays', { username: user, page });
    const plays = doc.querySelectorAll('plays > play');
    plays.forEach((p) => {
      const date = p.getAttribute('date');
      const id = p.querySelector('item')?.getAttribute('objectid');
      const g = id && byId.get(id);
      if (!g || !date || date.startsWith('0000')) return;
      if (!g.lastPlayed || date > g.lastPlayed) g.lastPlayed = date;
    });
    if (plays.length < 100) break;
    await sleep(1200);
  }
}

async function sync() {
  const user = $('#in-user').value.trim();
  saveSettingsFromForm();
  const status = $('#sync-status');
  const btn = $('#btn-sync');
  const say = (txt, cls = '') => {
    status.textContent = txt;
    status.className = 'status ' + cls;
  };
  if (!user) {
    say('✏️ Entre ton pseudo', 'err');
    return;
  }

  btn.disabled = true;
  try {
    say('📦 Collection…');
    const byId = await fetchCollection(user);
    if (!byId.size) throw new BggError('📭 Aucun jeu possédé sur BGG');

    try {
      await fetchDetails(byId, say);
    } catch (e) {
      console.warn('Détails indisponibles', e);
    }
    await fetchPlays(user, byId, say);

    state.library = { games: [...byId.values()], syncedAt: Date.now(), source: 'bgg' };
    // les parties BGG font foi : on oublie les parties notées localement
    state.localPlays = {};
    save(KEYS.localPlays, state.localPlays);
    save(KEYS.library, state.library);
    say(`✅ ${byId.size} jeux`, 'ok');
    refresh();
  } catch (e) {
    console.error(e);
    say(e instanceof BggError ? e.message : '😵 Oups, ça a raté', 'err');
  } finally {
    btn.disabled = false;
  }
}

/* ---------- Jeux exemples ---------- */

function demoLibrary() {
  const g = (id, name, minP, maxP, time, weight, styles, playedDaysAgo, numPlays) => ({
    id: 'demo-' + id,
    name,
    minP,
    maxP,
    time,
    weight,
    styles,
    thumb: '',
    image: '',
    numPlays,
    lastPlayed: playedDaysAgo == null ? null : daysAgoStr(playedDaysAgo),
  });
  return {
    source: 'demo',
    syncedAt: Date.now(),
    games: [
      g(1, 'Catan', 3, 4, 90, 2.3, ['strategy', 'family'], 40, 25),
      g(2, 'Azul', 2, 4, 45, 1.8, ['abstract', 'family'], 5, 30),
      g(3, 'Pandemic', 2, 4, 45, 2.4, ['coop', 'strategy'], 70, 12),
      g(4, 'Dixit', 3, 8, 30, 1.2, ['party', 'family', 'cards'], 12, 18),
      g(5, 'Terraforming Mars', 1, 5, 120, 3.3, ['strategy'], 90, 8),
      g(6, 'Codenames', 2, 8, 15, 1.3, ['party', 'cards'], 2, 40),
      g(7, 'Les Aventuriers du Rail', 2, 5, 60, 1.8, ['family'], 25, 22),
      g(8, '7 Wonders Duel', 2, 2, 30, 2.2, ['strategy', 'cards'], 8, 35),
      g(9, 'Spirit Island', 1, 4, 120, 4.1, ['coop', 'strategy', 'thematic'], null, 0),
      g(10, 'Kingdomino', 2, 4, 15, 1.2, ['family', 'kids'], 150, 15),
      g(11, 'The Crew', 2, 5, 20, 2.0, ['coop', 'cards'], 18, 20),
      g(12, 'Brass: Birmingham', 2, 4, 120, 3.9, ['strategy'], 200, 4),
      g(13, 'Just One', 3, 7, 20, 1.0, ['party', 'coop'], 33, 14),
      g(14, 'Wingspan', 1, 5, 70, 2.5, ['strategy', 'family'], 3, 16),
      g(15, 'Gloomhaven', 1, 4, 120, 3.9, ['coop', 'thematic', 'strategy'], null, 0),
      g(16, 'Skull', 3, 6, 30, 1.1, ['party'], 60, 9),
    ],
  };
}

function useDemo() {
  state.library = demoLibrary();
  state.localPlays = {};
  save(KEYS.localPlays, state.localPlays);
  save(KEYS.library, state.library);
  const status = $('#sync-status');
  status.textContent = '🎁 16 jeux exemples';
  status.className = 'status ok';
  refresh();
}

/* ---------- Réglages ---------- */

function openSettings() {
  $('#in-user').value = state.settings.user || '';
  $('#in-proxy').value = state.settings.proxy || '';
  $('#in-token').value = state.settings.token || '';
  const status = $('#sync-status');
  if (state.library) {
    const n = state.library.games.length;
    const when = new Date(state.library.syncedAt).toLocaleDateString('fr-FR');
    status.textContent = state.library.source === 'demo' ? `🎁 ${n} jeux exemples` : `📚 ${n} jeux · ${when}`;
    status.className = 'status ok';
  } else {
    status.textContent = '';
    status.className = 'status';
  }
  $('#settings').showModal();
}

function saveSettingsFromForm() {
  state.settings = {
    user: $('#in-user').value.trim(),
    proxy: $('#in-proxy').value.trim(),
    token: $('#in-token').value.trim(),
  };
  save(KEYS.settings, state.settings);
}

/* ---------- Démarrage ---------- */

document.querySelectorAll('.chips').forEach((g) => g.addEventListener('click', onChip));
$('#btn-reset').addEventListener('click', () => {
  state.filters = {};
  save(KEYS.filters, state.filters);
  refresh();
});
$('#btn-spin').addEventListener('click', spin);
$('#btn-play').addEventListener('click', markPlayed);
$('#btn-settings').addEventListener('click', openSettings);
$('#btn-sync').addEventListener('click', sync);
$('#btn-demo').addEventListener('click', useDemo);
$('#settings').addEventListener('close', saveSettingsFromForm);

refresh();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
