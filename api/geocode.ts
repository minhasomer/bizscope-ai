import type { IncomingMessage, ServerResponse } from 'http';

export const maxDuration = 10;

const US_STATE_ABBREVS: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
};

function json(res: ServerResponse, body: unknown): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const q = (url.searchParams.get('q') ?? '').trim();

  if (!q || q.length < 2) return json(res, []);

  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=en&limit=10&bbox=-180,18,-66,72`;
    const response = await fetch(photonUrl, {
      headers: { 'User-Agent': 'BizScopeAI/1.0' },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return json(res, []);

    const data = (await response.json()) as { features?: any[] };
    const features = data.features ?? [];

    const seen = new Set<string>();
    const results: string[] = [];

    for (const feature of features) {
      const p    = feature.properties ?? {};
      const code = ((p.country_code ?? '') as string).toUpperCase();
      if (code && code !== 'US') continue;

      const name:  string = (p.name  ?? '') as string;
      const state: string = (p.state ?? '') as string;
      const type:  string = ((p.type ?? p.osm_value ?? '') as string).toLowerCase();

      if (['house', 'road', 'street', 'neighbourhood', 'quarter', 'building'].includes(type)) continue;

      const stateAbbr = US_STATE_ABBREVS[state] ?? (state.length === 2 ? state.toUpperCase() : '');

      let formatted = '';
      if (type === 'state') {
        formatted = name;
      } else if (name && stateAbbr) {
        formatted = `${name}, ${stateAbbr}`;
      } else {
        continue;
      }

      if (formatted && !seen.has(formatted.toLowerCase())) {
        seen.add(formatted.toLowerCase());
        results.push(formatted);
      }
    }

    return json(res, results);
  } catch {
    return json(res, []);
  }
}
