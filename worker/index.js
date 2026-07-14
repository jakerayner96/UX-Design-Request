// Calls Cloudflare Workers AI server-side to suggest follow-up questions from the description.
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
      'Write ONE short follow-up question for each field below, tailored to what is actually in the ' +
      'description above. Do NOT answer or summarize the description — write a NEW clarifying question ' +
      'that helps the requester think through what to write, no more than 12 words, phrased so it reads ' +
      "naturally as a continuation of the question already shown to them. If nothing relevant can be " +
      'inferred from the description, leave that field as an empty string rather than inventing one.\n\n' +
      'problem: shown next to "What\'s broken, missing, or underperforming? What triggered this request?"\n' +
      'outcome: shown next to "What do others do? What does success for us look like?"\n\n' +
      'Respond with ONLY a single JSON object, no other text and no markdown fences, in exactly this shape:\n' +
      '{"problem": "...", "outcome": "..."}';

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
