/**
 * nivo-proxy — proxy Météo-France "Données d'observation v2"
 *
 * Setup :
 *   1. Créer un compte sur https://portail-api.meteofrance.fr/
 *   2. S'abonner à "Données d'observation - Version: v2"
 *   3. Copier la clé API générée
 *   4. Configurer le secret Supabase :
 *        supabase secrets set METEOFRANCE_OBS_KEY=<votre_clé>
 *   5. Déployer :
 *        supabase functions deploy nivo-proxy
 *
 * Appel frontend :
 *   POST /functions/v1/nivo-proxy
 *   Body: { stationId: "38395403" }
 *   Headers: apikey + Authorization (Supabase anon key)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MF_BASE = 'https://public-api.meteofrance.fr/public/DPObs/v2';

function isoZ(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const mfKey = Deno.env.get('METEOFRANCE_OBS_KEY');
    if (!mfKey) {
      return new Response(
        JSON.stringify({
          error: 'METEOFRANCE_OBS_KEY not configured',
          setup: 'https://portail-api.meteofrance.fr/ → Données d\'observation v2',
        }),
        { status: 503, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json() as { stationId?: string };
    const { stationId } = body;
    if (!stationId) {
      return new Response(
        JSON.stringify({ error: 'stationId required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    // L'API "Données d'observation" couvre seulement les 24 dernières heures
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Endpoint v2 — observations horaires pour une station
    const url =
      `${MF_BASE}/station/horaire` +
      `?id-station=${encodeURIComponent(stationId)}` +
      `&date-deb-periode=${encodeURIComponent(isoZ(start))}` +
      `&date-fin-periode=${encodeURIComponent(isoZ(now))}` +
      `&format=json`;

    const mfRes = await fetch(url, { headers: { apikey: mfKey } });

    if (!mfRes.ok) {
      const text = await mfRes.text();
      // Essayer le endpoint 6-minutes si horaire échoue (certaines stations)
      if (mfRes.status === 404) {
        const url6m =
          `${MF_BASE}/station/infrahoraire-6m` +
          `?id-station=${encodeURIComponent(stationId)}` +
          `&date-deb-periode=${encodeURIComponent(isoZ(start))}` +
          `&date-fin-periode=${encodeURIComponent(isoZ(now))}` +
          `&format=json`;
        const mfRes6m = await fetch(url6m, { headers: { apikey: mfKey } });
        if (mfRes6m.ok) {
          const raw6m = await mfRes6m.json();
          return jsonObs(stationId, raw6m);
        }
      }
      return new Response(
        JSON.stringify({ error: `Météo-France ${mfRes.status}`, detail: text }),
        { status: mfRes.status, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const raw = await mfRes.json();
    return jsonObs(stationId, raw);

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});

type RawObs = Record<string, unknown>;

function jsonObs(stationId: string, raw: unknown): Response {
  const arr: RawObs[] = Array.isArray(raw) ? raw : [];
  const observations = arr.map(o => ({
    date:    (o['date'] ?? o['validity_time'] ?? o['reference_time'] ?? '') as string,
    // t en Kelvin → °C
    tempC:   typeof o['t']   === 'number' ? +(Number(o['t'])  - 273.15).toFixed(1) : null,
    // ff en m/s → km/h
    windKph: typeof o['ff']  === 'number' ? +(Number(o['ff']) * 3.6).toFixed(1)    : null,
    windDir: typeof o['dd']  === 'number' ? Number(o['dd'])                         : null,
    // sss en m → cm
    snowCm:  typeof o['sss'] === 'number' ? +(Number(o['sss']) * 100).toFixed(0)   : null,
    rainMm:  typeof o['rr1'] === 'number' ? Number(o['rr1'])                        : null,
    humPct:  typeof o['u']   === 'number' ? Number(o['u'])                          : null,
  }));
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  return new Response(
    JSON.stringify({ stationId, observations }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } }
  );
}
