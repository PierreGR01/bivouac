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
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  let blitzWs: WebSocket | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const cleanup = () => {
    closed = true;
    if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
    if (reconnectTimeout) { clearTimeout(reconnectTimeout); reconnectTimeout = null; }
    if (blitzWs) { try { blitzWs.close(); } catch { /* ignore */ } blitzWs = null; }
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

      // Blitzortung servers — rotate on reconnect
      const serverIds = [1, 5, 6, 7];
      let serverIndex = Math.floor(Math.random() * serverIds.length);

      const connect = () => {
        if (closed) return;
        const serverId = serverIds[serverIndex % serverIds.length];
        serverIndex++;

        console.log(`[lightning-proxy] connecting to ws${serverId}.blitzortung.org`);

        try {
          blitzWs = new WebSocket(`wss://ws${serverId}.blitzortung.org:3000/`);
        } catch (err) {
          console.error('[lightning-proxy] WebSocket constructor error:', err);
          if (!closed) reconnectTimeout = setTimeout(connect, 5000);
          return;
        }

        blitzWs.onopen = () => {
          console.log('[lightning-proxy] Blitzortung connected');
          // Subscribe to all strikes (server streams immediately)
          blitzWs?.send(JSON.stringify({ time: 0 }));
        };

        blitzWs.onmessage = (event) => {
          if (closed) return;
          let strike: { lat?: number; lon?: number; time?: number };
          try {
            strike = JSON.parse(event.data as string);
          } catch {
            return;
          }

          if (
            typeof strike.lat !== 'number' ||
            typeof strike.lon !== 'number' ||
            typeof strike.time !== 'number'
          ) return;

          // Blitzortung timestamps are nanoseconds since Unix epoch
          const timeMs = Math.round(strike.time / 1e6);
          const { lat, lon } = strike;

          // Filter to Europe + Mediterranean (Alpes, Pyrénées, etc.)
          if (lat < 30 || lat > 75 || lon < -20 || lon > 50) return;

          enqueue(`data: ${JSON.stringify({ lat, lon, time: timeMs })}\n\n`);
        };

        blitzWs.onerror = (err) => {
          console.error('[lightning-proxy] Blitzortung WS error:', err);
        };

        blitzWs.onclose = () => {
          console.log('[lightning-proxy] Blitzortung WS closed — reconnecting in 5s');
          blitzWs = null;
          if (!closed) reconnectTimeout = setTimeout(connect, 5000);
        };
      };

      connect();
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
