// Reads an uploaded work schedule (PDF or image) with Claude and returns the shifts it finds.
// Runs on Netlify's edge (Deno). The Anthropic key stays on the server; the browser never sees it.
// Only a signed-in Cottage account can call it: the caller's Supabase token is checked first.
// Nothing is saved here. The app shows the result for review and saves only what the person keeps.

declare const Netlify: { env: { get(name: string): string | undefined } };

export const config = { path: '/api/read-schedule' };

const MODEL_DEFAULT = 'claude-sonnet-5-5';
const MAX_BASE64 = 8_000_000; // ~6 MB file
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

interface Body {
  file?: string;
  mediaType?: string;
  memberName?: string;
  today?: string;
}

const TOOL = {
  name: 'record_shifts',
  description: 'Record the work shifts found in the schedule.',
  input_schema: {
    type: 'object',
    properties: {
      shifts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Start date, YYYY-MM-DD' },
            start: { type: 'string', description: 'Start time, 24-hour HH:MM' },
            endDate: { type: 'string', description: 'End date, YYYY-MM-DD. The next day for a shift that ends after midnight.' },
            end: { type: 'string', description: 'End time, 24-hour HH:MM' },
            note: { type: 'string', description: 'Optional short note, e.g. a location or "time hard to read"' },
          },
          required: ['date', 'start', 'endDate', 'end'],
        },
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Short plain-English notes about anything unclear, skipped or ambiguous.',
      },
    },
    required: ['shifts', 'warnings'],
  },
};

function prompt(name: string, today: string): string {
  return [
    `This is a work schedule for ${name}. Today is ${today}.`,
    `Find every work shift for ${name} and record it with the record_shifts tool.`,
    `Rules:`,
    `- If the schedule lists several people, include only ${name}'s shifts. If you cannot tell which rows are ${name}'s, record no shifts and say so in warnings.`,
    `- Use 24-hour HH:MM times and YYYY-MM-DD dates.`,
    `- If a date has no year, use the year that puts it closest to today.`,
    `- A shift that ends after midnight ends on the next day: set endDate to that day.`,
    `- Skip days off, PTO, holidays and blank days. Do not record them as shifts.`,
    `- Never guess a time you cannot read. Leave that shift out and add a warning naming the date.`,
    `- Keep warnings short.`,
  ].join('\n');
}

async function signedIn(req: Request): Promise<boolean> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const url = Netlify.env.get('VITE_SUPABASE_URL') ?? Netlify.env.get('SUPABASE_URL');
  const anon = Netlify.env.get('VITE_SUPABASE_ANON_KEY');
  if (!token || !url || !anon) return false;
  const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: anon, authorization: `Bearer ${token}` } });
  return res.ok;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'Use POST.' });
  if (!(await signedIn(req))) return json(401, { error: 'Sign in to read a schedule.' });

  const key = Netlify.env.get('ANTHROPIC_API_KEY');
  if (!key) return json(503, { error: 'Schedule reading isn’t set up on the server yet.' });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json(400, { error: 'The upload was not readable.' });
  }
  const { file, mediaType, memberName, today } = body;
  if (!file || !mediaType || !memberName || !today) return json(400, { error: 'The upload was incomplete.' });
  if (file.length > MAX_BASE64) return json(413, { error: 'That file is too large. Use a PDF under 6 MB or a photo.' });
  const isPdf = mediaType === 'application/pdf';
  if (!isPdf && !IMAGE_TYPES.has(mediaType)) return json(415, { error: 'Upload a PDF or a photo (JPEG, PNG, WebP).' });

  const source = { type: 'base64', media_type: mediaType, data: file };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: Netlify.env.get('ANTHROPIC_MODEL') || MODEL_DEFAULT,
      max_tokens: 4000,
      tools: [TOOL],
      tool_choice: { type: 'tool', name: TOOL.name },
      messages: [
        {
          role: 'user',
          content: [
            isPdf ? { type: 'document', source } : { type: 'image', source },
            { type: 'text', text: prompt(memberName.slice(0, 60), today.slice(0, 10)) },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    console.error('read-schedule: Anthropic error', res.status, (await res.text()).slice(0, 500));
    return json(502, { error: 'The schedule reader is unavailable right now. Try again, or add shifts by hand.' });
  }
  const out = (await res.json()) as { content?: { type: string; name?: string; input?: unknown }[] };
  const call = out.content?.find((c) => c.type === 'tool_use' && c.name === TOOL.name);
  if (!call?.input) return json(502, { error: 'No shifts could be read from that file.' });
  return json(200, call.input);
}
