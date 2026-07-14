// Calls the Anthropic API server-side so the API key never reaches the browser.
// Secret (ANTHROPIC_API_KEY) is set via `wrangler secret put`, not committed here.

const ALLOWED_ORIGINS = new Set([
  'https://jakerayner96.github.io',
  'null', // file:// local testing
]);

const MODEL = 'claude-haiku-4-5-20251001';
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

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        tools: [{
          name: 'fill_ticket_fields',
          description: 'Return draft content for the other UX ticket fields, inferred from the description.',
          input_schema: {
            type: 'object',
            properties: {
              problem: { type: 'string', description: "What's broken, missing, or underperforming that triggered this request. Empty string if not inferable from the description." },
              outcome: { type: 'string', description: 'The outcome or success the requester wants to achieve. Empty string if not inferable.' },
              success: { type: 'string', description: 'A short, measurable success metric (e.g. conversion rate, AOV, engagement). Empty string if not inferable.' },
              inputs: { type: 'string', description: 'Any inputs, assets, guidelines, or benchmarking links mentioned. Empty string if none mentioned.' },
              constraints: { type: 'string', description: 'Any technical, legal, commercial, or accessibility constraints mentioned. Empty string if none mentioned.' },
            },
            required: ['problem', 'outcome', 'success', 'inputs', 'constraints'],
          },
        }],
        tool_choice: { type: 'tool', name: 'fill_ticket_fields' },
        messages: [{
          role: 'user',
          content: 'Description of a UX design request:\n\n' + description +
            '\n\nDraft short, concise content for each field below, based only on what the description genuinely supports. ' +
            "Leave a field as an empty string rather than inventing detail that isn't there.",
        }],
      }),
    });

    if (!res.ok) {
      return json({ ok: false, error: 'AI request failed: ' + res.status }, 502, headers);
    }

    const data = await res.json();
    const toolUse = (data.content || []).find(block => block.type === 'tool_use');
    if (!toolUse) {
      return json({ ok: false, error: 'No suggestions returned' }, 502, headers);
    }

    return json({ ok: true, suggestions: toolUse.input }, 200, headers);
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
