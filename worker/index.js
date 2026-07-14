// Calls the Google Gemini API server-side so the API key never reaches the browser.
// Secret (GEMINI_API_KEY) is set via `wrangler secret put`, not committed here.

const ALLOWED_ORIGINS = new Set([
  'https://jakerayner96.github.io',
  'null', // file:// local testing
]);

const MODEL = 'gemini-2.0-flash';
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
      'problem: what\'s broken, missing, or underperforming that triggered this request.\n' +
      'outcome: the outcome or success the requester wants to achieve.\n' +
      'success: a short, measurable success metric (e.g. conversion rate, AOV, engagement).\n' +
      'inputs: any inputs, assets, guidelines, or benchmarking links mentioned.\n' +
      'constraints: any technical, legal, commercial, or accessibility constraints mentioned.';

    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent?key=' + env.GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: 'application/json',
            response_schema: {
              type: 'OBJECT',
              properties: {
                problem: { type: 'STRING' },
                outcome: { type: 'STRING' },
                success: { type: 'STRING' },
                inputs: { type: 'STRING' },
                constraints: { type: 'STRING' },
              },
              required: ['problem', 'outcome', 'success', 'inputs', 'constraints'],
            },
          },
        }),
      },
    );

    if (!res.ok) {
      return json({ ok: false, error: 'AI request failed: ' + res.status }, 502, headers);
    }

    const data = await res.json();
    const text = data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;
    if (!text) {
      return json({ ok: false, error: 'No suggestions returned' }, 502, headers);
    }

    let suggestions;
    try {
      suggestions = JSON.parse(text);
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
