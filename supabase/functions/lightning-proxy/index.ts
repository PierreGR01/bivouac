Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const encoder = new TextEncoder();
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  // Track seen strikes: key -> first-seen timestamp (ms) to allow pruning
  const seenStrikes = new Map<string, number>();

  const cleanup = () => {
    closed = true;
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
  };

  const stream = new ReadableStream({
    start(controller) {
      const enqueue = (data: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch {
          cleanup();
        }
      };

      enqueue(': keepalive\n\n');
      heartbeatInterval = setInterval(() => enqueue(': keepalive\n\n'), 25000);

      const poll = async (isFirst: boolean) => {
        if (closed) return;
        try {
          const duree = isFirst ? 30 : 1;
          const resp = await fetch('https://www.meteociel.fr/obs/foudre/temps-reel.php', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Referer': 'https://www.meteociel.fr/observations-meteo/foudre-direct.php',
            },
            body: `first=1&duree=${duree}&region=fr&dontwait=1&modeloc=1`,
          });

          if (!resp.ok) {
            console.warn(`[lightning-proxy] poll HTTP ${resp.status}`);
            return;
          }

          const json = await resp.json() as { items?: Array<{ x: number; y: number; d: number }> };
          const items = json.items ?? [];
          console.log(`[lightning-proxy] poll duree=${duree} → ${items.length} items`);

          const now = Date.now();

          // Prune strikes older than 35 minutes from the dedup map
          for (const [k, t] of seenStrikes) {
            if (now - t > 35 * 60 * 1000) seenStrikes.delete(k);
          }

          for (const item of items) {
            const key = `${item.x.toFixed(2)},${item.y.toFixed(2)}`;
            if (seenStrikes.has(key)) continue;
            seenStrikes.set(key, now);

            // Meteociel returns coordinates in tile-pixel space (0–768).
            // Conversion to geographic coordinates (Web Mercator):
            const lon = (item.x / 768) * 360 - 180;
            const latMerc = 1 - 2 * (item.y / 768);
            const lat = Math.atan(Math.sinh(Math.PI * latMerc)) * (180 / Math.PI);

            if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;

            // Filter to Europe + Mediterranean to avoid flooding Leaflet with global strikes
            if (lat < 30 || lat > 75 || lon < -20 || lon > 50) continue;

            // On first connection, only replay the last 60 seconds to avoid marker overload
            if (isFirst && item.d > 60) continue;

            // item.d is "seconds ago"
            const time = now - Math.round(item.d * 1000);
            enqueue(`data: ${JSON.stringify({ lat, lon, time })}\n\n`);
          }
        } catch (err) {
          console.error('[lightning-proxy] poll error:', err);
        }
      };

      poll(true);
      pollInterval = setInterval(() => poll(false), 5000);
    },

    cancel() { cleanup(); },
  });

  req.signal.addEventListener('abort', () => { cleanup(); });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
});
