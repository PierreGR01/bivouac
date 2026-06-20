// Minimal MQTT 3.1.1 client over raw TCP — Deno.connect()
// Connects to the public Blitzortung MQTT broker and streams strikes as SSE.

// --- MQTT packet builders ---

function encodeStr(s: string): Uint8Array {
  const b = new TextEncoder().encode(s);
  const out = new Uint8Array(2 + b.length);
  out[0] = b.length >> 8; out[1] = b.length & 0xff;
  out.set(b, 2);
  return out;
}

function encodeVarLen(n: number): Uint8Array {
  const out: number[] = [];
  do {
    let byte = n & 0x7f; n >>= 7;
    if (n > 0) byte |= 0x80;
    out.push(byte);
  } while (n > 0);
  return new Uint8Array(out);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
}

function buildConnect(clientId: string): Uint8Array {
  // Variable header: "MQTT" + level 4 + flags + keepalive 60s
  const vh = new Uint8Array([0, 4, 77, 81, 84, 84, 4, 0x02, 0, 60]);
  const cid = encodeStr(clientId);
  const rem = vh.length + cid.length;
  return concat(new Uint8Array([0x10]), encodeVarLen(rem), vh, cid);
}

function buildSubscribe(topic: string, packetId: number): Uint8Array {
  const vh = new Uint8Array([packetId >> 8, packetId & 0xff]);
  const topicBytes = encodeStr(topic);
  const qos = new Uint8Array([0]); // QoS 0
  const rem = vh.length + topicBytes.length + qos.length;
  return concat(new Uint8Array([0x82]), encodeVarLen(rem), vh, topicBytes, qos);
}

const PINGREQ = new Uint8Array([0xC0, 0]);

// --- MQTT packet parser (stateful, handles incomplete TCP reads) ---

class MqttParser {
  private buf = new Uint8Array(0);

  feed(data: Uint8Array): Array<{ type: number; payload: Uint8Array }> {
    this.buf = concat(this.buf, data);
    const packets: Array<{ type: number; payload: Uint8Array }> = [];
    while (this.buf.length >= 2) {
      const type = this.buf[0];
      let i = 1;
      let rem = 0, mult = 1;
      while (i < this.buf.length) {
        const b = this.buf[i++];
        rem += (b & 0x7f) * mult; mult *= 128;
        if ((b & 0x80) === 0) break;
        if (mult > 128 * 128 * 128) break; // malformed
      }
      if (i > this.buf.length) break; // need more header bytes
      if (i + rem > this.buf.length) break; // need more payload bytes
      packets.push({ type, payload: this.buf.slice(i, i + rem) });
      this.buf = this.buf.slice(i + rem);
    }
    return packets;
  }
}

// Decode a PUBLISH packet payload → strike or null
function decodePublish(payload: Uint8Array): { lat: number; lon: number; time: number } | null {
  let i = 0;
  if (i + 2 > payload.length) return null;
  const topicLen = (payload[i++] << 8) | payload[i++];
  i += topicLen; // skip topic name
  // QoS is 0 so no packet identifier
  const body = new TextDecoder().decode(payload.slice(i));
  try {
    const d = JSON.parse(body) as Record<string, unknown>;
    const lat = d.lat as number, lon = d.lon as number;
    if (typeof lat !== 'number' || typeof lon !== 'number') return null;
    // time field is nanoseconds (blitzortung convention)
    const timeMs = typeof d.time === 'number' ? Math.round((d.time as number) / 1e6) : Date.now();
    return { lat, lon, time: timeMs };
  } catch { return null; }
}

// --- Edge Function ---

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
  let pingInterval: ReturnType<typeof setInterval> | null = null;
  let conn: Deno.TcpConn | null = null;
  let closed = false;

  const cleanup = () => {
    closed = true;
    if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
    if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
    if (conn) { try { conn.close(); } catch { /* ignore */ } conn = null; }
  };

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (data: string) => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(data)); }
        catch { cleanup(); }
      };

      enqueue(': keepalive\n\n');
      heartbeatInterval = setInterval(() => enqueue(': keepalive\n\n'), 25000);

      try {
        conn = await Deno.connect({ hostname: 'blitzortung.ha.sed.pl', port: 1883 });
        console.log('[lightning-proxy] MQTT TCP connected');

        const clientId = `bivouac-${Date.now().toString(36)}`;
        await conn.write(buildConnect(clientId));

        // Keep connection alive with MQTT PINGREQ every 45s
        pingInterval = setInterval(async () => {
          if (conn && !closed) {
            try { await conn.write(PINGREQ); } catch { /* connection lost */ }
          }
        }, 45000);

        const parser = new MqttParser();
        const readBuf = new Uint8Array(4096);
        let subscribed = false;

        while (!closed) {
          let n: number | null;
          try { n = await conn.read(readBuf); }
          catch { break; }
          if (n === null) break;

          const packets = parser.feed(readBuf.slice(0, n));
          for (const pkt of packets) {
            const ptype = pkt.type & 0xf0;

            if (ptype === 0x20 && !subscribed) {
              // CONNACK — subscribe to Europe (geohash prefix 'u')
              subscribed = true;
              await conn.write(buildSubscribe('blitzortung/1.1/u/#', 1));
              console.log('[lightning-proxy] MQTT subscribed');
            }

            if (ptype === 0x30) {
              // PUBLISH — lightning strike
              const strike = decodePublish(pkt.payload);
              if (!strike) continue;
              const { lat, lon, time } = strike;
              // Filter: Europe (Alpes, Pyrénées) — 30–75°N, –20–50°E
              if (lat < 30 || lat > 75 || lon < -20 || lon > 50) continue;
              enqueue(`data: ${JSON.stringify({ lat, lon, time })}\n\n`);
            }
          }
        }
      } catch (err) {
        console.error('[lightning-proxy] error:', err);
      } finally {
        cleanup();
        try { controller.close(); } catch { /* ignore */ }
      }
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
