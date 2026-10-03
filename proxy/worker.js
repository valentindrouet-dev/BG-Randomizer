// Petit relais Cloudflare Worker vers l'API XML de BoardGameGeek.
// - ajoute le jeton BGG (secret BGG_TOKEN) côté serveur
// - ajoute les en-têtes CORS pour que l'appli puisse lire les réponses
// - n'autorise que les trois appels utilisés par l'appli

const ALLOWED = new Set(['/xmlapi2/collection', '/xmlapi2/plays', '/xmlapi2/thing']);

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors });

    const url = new URL(request.url);
    if (!ALLOWED.has(url.pathname)) return new Response('Not found', { status: 404, headers: cors });

    const headers = { 'User-Agent': 'BG-Randomizer' };
    if (env.BGG_TOKEN) headers.Authorization = `Bearer ${env.BGG_TOKEN}`;

    const upstream = await fetch(`https://boardgamegeek.com${url.pathname}${url.search}`, { headers });
    const out = new Headers(cors);
    out.set('Content-Type', upstream.headers.get('Content-Type') || 'text/xml; charset=utf-8');
    out.set('Cache-Control', 'no-store');
    return new Response(upstream.body, { status: upstream.status, headers: out });
  },
};
