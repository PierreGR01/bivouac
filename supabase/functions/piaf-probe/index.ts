/**
 * piaf-probe — fonction TEMPORAIRE de découverte de l'API PIAF (prévision immédiate précipitations).
 * À supprimer une fois les noms de layers/styles confirmés.
 *
 * Setup :
 *   supabase secrets set METEOFRANCE_PIAF_KEY=<votre_clé>
 *   supabase functions deploy piaf-probe
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESOURCE = 'MF-NWP-HIGHRES-PIAF-001-FRANCE-WMS';
const MODEL_SEGMENTS = ['piaf', 'arome-piaf', 'aromepiaf', 'arome-pi'];
const BASE_CANDIDATES = MODEL_SEGMENTS.map(
  (seg) => `https://public-api.meteofrance.fr/public/${seg}/1.0/wms/${RESOURCE}`
);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const piafKey = Deno.env.get('METEOFRANCE_PIAF_KEY');
  if (!piafKey) {
    return new Response(JSON.stringify({ error: 'METEOFRANCE_PIAF_KEY not configured' }), {
      status: 503, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const results: Record<string, unknown> = {};
  for (const base of BASE_CANDIDATES) {
    const url = `${base}/GetCapabilities?service=WMS&version=1.3.0`;
    try {
      const res = await fetch(url, { headers: { apikey: piafKey } });
      const text = await res.text();
      results[base] = { status: res.status, bodyStart: text.slice(0, 500) };
    } catch (err) {
      results[base] = { error: String(err) };
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
