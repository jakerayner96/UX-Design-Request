// Proxies Trello card/attachment creation so the API key/token never reach the browser.
// Secrets (TRELLO_KEY, TRELLO_TOKEN) are set via `wrangler secret put`, not committed here.

const ALLOWED_ORIGINS = new Set([
  'https://jakerayner96.github.io',
  'null', // file:// local testing
]);

const IDLIST = '699d774274279339e0ae8166'; // Inbox, on UX Board 2026

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://jakerayner96.github.io';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);
    if (request.method !== 'POST' || url.pathname !== '/create-ticket') {
      return new Response('Not found', { status: 404, headers });
    }

    try {
      const form = await request.formData();
      const name = form.get('name');
      const desc = form.get('desc') || '';
      const files = form.getAll('file');

      if (!name) {
        return json({ ok: false, error: 'Missing card name' }, 400, headers);
      }

      const auth = 'key=' + env.TRELLO_KEY + '&token=' + env.TRELLO_TOKEN;

      const cres = await fetch('https://api.trello.com/1/cards?' + new URLSearchParams({
        key: env.TRELLO_KEY, token: env.TRELLO_TOKEN,
        idList: IDLIST, name, desc, pos: 'top',
      }), { method: 'POST' });
      if (!cres.ok) {
        return json({ ok: false, error: 'Card creation failed: ' + cres.status }, 502, headers);
      }
      const card = await cres.json();

      const failed = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file, file.name);
        try {
          const ares = await fetch('https://api.trello.com/1/cards/' + card.id + '/attachments?' + auth, {
            method: 'POST', body: fd,
          });
          if (!ares.ok) failed.push(file.name);
        } catch (e) {
          failed.push(file.name);
        }
      }

      return json({ ok: true, url: card.shortUrl || card.url, failed }, 200, headers);
    } catch (err) {
      return json({ ok: false, error: err.message || 'Unexpected error' }, 500, headers);
    }
  },
};

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
