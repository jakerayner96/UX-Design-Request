// Calls Cloudflare Workers AI server-side to prefill fields from the description.
// No external API key needed — the AI binding runs on Cloudflare's own infrastructure.

const ALLOWED_ORIGINS = new Set([
  'https://jakerayner96.github.io',
  'null', // file:// local testing
]);

const MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';
const MAX_DESCRIPTION_LENGTH = 4000;

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

    if (request.method === 'POST' && url.pathname === '/suggest') {
      return handleSuggest(request, env, headers);
    }

    return new Response('Not found', { status: 404, headers });
  },
};

async function handleSuggest(request, env, headers) {
  try {
    const body = await request.json();
    const description = (body.description || '').trim().slice(0, MAX_DESCRIPTION_LENGTH);
    if (!description) {
      return json({ ok: false, error: 'Missing description' }, 400, headers);
    }

    const prompt = 'Description of a UX design request:\n"""\n' + description + '\n"""\n\n' +
      'Draft short, concise content for each field below, based only on what the description genuinely supports. ' +
      "Leave a field as an empty string rather than inventing detail that isn't there.\n\n" +
      'Respond with ONLY a single JSON object, no other text and no markdown fences, in exactly this shape:\n' +
      '{"problem": "...", "outcome": "...", "success": "...", "inputs": "...", "constraints": "..."}\n\n' +
      'problem: what\'s broken, missing, or underperforming that triggered this request.\n' +
      'outcome: the outcome or success the requester wants to achieve.\n' +
      'success: a short, measurable success metric (e.g. conversion rate, AOV, engagement).\n' +
      'inputs: any inputs, assets, guidelines, or benchmarking links mentioned.\n' +
      'constraints: any technical, legal, commercial, or accessibility constraints mentioned.';

    const result = await env.AI.run(MODEL, {
      messages: [
        { role: 'system', content: 'You output only valid JSON, with no surrounding text or markdown.' },
        { role: 'user', content: prompt },
      ],
    });

    const text = (result && result.response) || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return json({ ok: false, error: 'No suggestions returned' }, 502, headers);
    }

    let suggestions;
    try {
      suggestions = JSON.parse(match[0]);
    } catch (e) {
      return json({ ok: false, error: 'Could not parse suggestions' }, 502, headers);
    }

    return json({ ok: true, suggestions }, 200, headers);
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
