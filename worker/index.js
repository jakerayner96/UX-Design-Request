// Forwards submitted ticket data to a Google Apps Script Web App, which
// appends a row to a Google Sheet. The Sheet URL/script lives in the user's
// own Google Drive — this Worker only holds the Apps Script webhook URL,
// as a secret, so it never reaches the browser or this repo.

const ALLOWED_ORIGINS = new Set([
  'https://jakerayner96.github.io',
  'null', // file:// local testing
]);

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

    if (request.method === 'POST' && url.pathname === '/log-ticket') {
      return handleLogTicket(request, env, headers);
    }

    return new Response('Not found', { status: 404, headers });
  },
};

async function handleLogTicket(request, env, headers) {
  try {
    if (!env.SHEETS_WEBHOOK_URL) {
      return json({ ok: false, error: 'Backlog logging is not configured' }, 500, headers);
    }

    const fields = await request.json();

    const res = await fetch(env.SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(fields),
    });

    if (!res.ok) {
      return json({ ok: false, error: 'Sheet logging failed: ' + res.status }, 502, headers);
    }

    return json({ ok: true }, 200, headers);
  } catch (err) {
    return json({ ok: false, error: err.message || 'Unexpected error' }, 500, headers);
  }
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}
