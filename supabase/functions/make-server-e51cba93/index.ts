import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";

// Gestionnaire global pour les erreurs non capturées de Deno
globalThis.addEventListener("error", (event) => {
  const error = event.error;
  if (
    error?.code === 'EPIPE' ||
    error?.name === 'Http' ||
    error?.message?.includes('connection closed') ||
    error?.message?.includes('broken pipe')
  ) {
    event.preventDefault();
    return;
  }
});

globalThis.addEventListener("unhandledrejection", (event) => {
  const error = event.reason;
  if (
    error?.code === 'EPIPE' ||
    error?.name === 'Http' ||
    error?.message?.includes('connection closed') ||
    error?.message?.includes('broken pipe')
  ) {
    event.preventDefault();
    return;
  }
});

const app = new Hono();

const safeHandler = (handler: any) => async (c: any) => {
  try {
    return await handler(c);
  } catch (error: any) {
    if (
      error?.code === 'EPIPE' ||
      error?.name === 'Http' ||
      error?.message?.includes('connection closed') ||
      error?.message?.includes('broken pipe')
    ) {
      console.log('ℹ️ Client a fermé la connexion (ignoré)');
      return new Response(null, { status: 499 });
    }
    console.error('❌ Erreur serveur:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
};

// --- Security helpers ---

async function requireAdmin(c: any): Promise<boolean> {
  const authHeader = c.req.header("Authorization") as string | undefined;
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  // Verify the bearer token as a real user session (anon key has role:"anon", not "authenticated")
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return false;
  // Check admin_users table via service role (bypasses RLS)
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data } = await adminClient
    .from("admin_users")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  return !!data;
}

function validateBounds(body: any): { south: number; west: number; north: number; east: number } {
  const clamp = (v: unknown, min: number, max: number, name: string): number => {
    const n = Number(v);
    if (!isFinite(n) || n < min || n > max) throw new Error(`Invalid ${name}: ${v}`);
    return n;
  };
  return {
    south: clamp(body.south, -90, 90, "south"),
    west:  clamp(body.west,  -180, 180, "west"),
    north: clamp(body.north, -90, 90, "north"),
    east:  clamp(body.east,  -180, 180, "east"),
  };
}

function validateTimeout(val: unknown, maxSec = 60): number {
  const n = Math.floor(Number(val));
  return isFinite(n) && n >= 5 && n <= maxSec ? n : 30;
}

// In-memory sliding-window rate limiter (resets on cold start — acceptable for Edge Functions)
const _rateWindows = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxPerWindow: number, windowMs = 3_600_000): boolean {
  const now = Date.now();
  const w = _rateWindows.get(key);
  if (!w || now > w.resetAt) {
    _rateWindows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (w.count >= maxPerWindow) return false;
  w.count++;
  return true;
}

// --- CORS ---
// Set ALLOWED_ORIGIN Supabase secret to restrict to your Vercel domain in production.
// Falls back to "*" if not set (permissive — set the secret when you know your deployment URL).
app.use(
  "/*",
  cors({
    origin: Deno.env.get("ALLOWED_ORIGIN") || "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check
app.get("/make-server-e51cba93/health", safeHandler((c: any) => {
  return c.json({ status: "ok" });
}));

// Get all POIs — public read
app.get("/make-server-e51cba93/pois", safeHandler(async (c: any) => {
  try {
    const pois = await kv.getByPrefix("poi:");
    return c.json({ success: true, data: pois });
  } catch (error) {
    console.error("Error fetching POIs:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Create a new POI — rate-limited, no auth required (any visitor can propose a spot)
app.post("/make-server-e51cba93/pois", safeHandler(async (c: any) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(`create:${ip}`, 20)) {
    return c.json({ success: false, error: "Too many requests" }, 429);
  }

  try {
    const body = await c.req.json();
    const { id, title, description, photos, season, waterProximity, naturalWaterProximity, regulations, position, altitude, capacity, difficulty, ratings } = body;

    if (!id || !title || !position) {
      return c.json({ success: false, error: "Missing required fields: id, title, position" }, 400);
    }

    const poi = {
      id,
      title,
      description,
      photos,
      season,
      waterProximity,
      naturalWaterProximity,
      regulations,
      position,
      altitude,
      capacity,
      difficulty,
      ratings: ratings || [],
      createdAt: new Date().toISOString(),
    };

    await kv.set(`poi:${id}`, poi);
    console.log(`✅ POI créé avec altitude: ${altitude || 'N/A'}m, capacité: ${capacity || 'N/A'}, difficulté: ${difficulty || 'N/A'}`);
    return c.json({ success: true, data: poi });
  } catch (error) {
    console.error("Error creating POI:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Update (patch) a POI — admin only, field allowlist enforced
app.put("/make-server-e51cba93/pois/:id", safeHandler(async (c: any) => {
  if (!(await requireAdmin(c))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const id = c.req.param("id");
    const raw = await c.req.json();

    // Allowlist: only known enrichment/content fields may be updated
    const ALLOWED_FIELDS = new Set([
      "title", "description", "photos", "season", "waterProximity",
      "naturalWaterProximity", "regulations", "altitude", "capacity",
      "difficulty", "ratings",
    ]);
    const updates = Object.fromEntries(
      Object.entries(raw).filter(([k]) => ALLOWED_FIELDS.has(k))
    );

    const existing = await kv.get(`poi:${id}`);
    if (!existing) {
      return c.json({ success: false, error: "POI not found" }, 404);
    }

    const updated = { ...existing, ...updates };
    await kv.set(`poi:${id}`, updated);
    console.log(`✅ POI ${id} mis à jour (altitude: ${updated.altitude ?? 'N/A'}m, eau: ${updated.waterProximity ?? 'N/A'})`);
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating POI:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Add a rating to a POI — rate-limited, no auth required
app.post("/make-server-e51cba93/pois/:id/rate", safeHandler(async (c: any) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(`rate:${ip}`, 30)) {
    return c.json({ success: false, error: "Too many requests" }, 429);
  }

  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { rating, comment } = body;

    if (typeof rating !== 'number' || rating < 0 || rating > 5) {
      return c.json({ success: false, error: "Rating must be a number between 0 and 5" }, 400);
    }
    if (typeof comment !== 'string' || comment.trim().split(/\s+/).filter(Boolean).length < 3) {
      return c.json({ success: false, error: "Comment must be at least 3 words" }, 400);
    }

    const poi = await kv.get(`poi:${id}`);
    if (!poi) {
      return c.json({ success: false, error: "POI not found" }, 404);
    }

    const review = { rating, comment: comment.trim(), createdAt: new Date().toISOString() };
    const updatedPoi = {
      ...poi,
      ratings: [...(poi.ratings || []), rating],
      reviews: [...(poi.reviews || []), review],
    };
    await kv.set(`poi:${id}`, updatedPoi);
    console.log(`✅ Note ajoutée au POI ${id}: ${rating}/5 — "${comment.trim()}"`);
    return c.json({ success: true, data: updatedPoi });
  } catch (error) {
    console.error("Error adding rating:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Delete a specific review — admin only
app.delete("/make-server-e51cba93/pois/:id/reviews/:createdAt", safeHandler(async (c: any) => {
  if (!(await requireAdmin(c))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }
  try {
    const id = c.req.param("id");
    const createdAt = decodeURIComponent(c.req.param("createdAt"));
    const poi = await kv.get(`poi:${id}`);
    if (!poi) return c.json({ success: false, error: "POI not found" }, 404);
    const updatedReviews = (poi.reviews || []).filter((r: any) => r.createdAt !== createdAt);
    const updatedPoi = { ...poi, reviews: updatedReviews, ratings: updatedReviews.map((r: any) => r.rating) };
    await kv.set(`poi:${id}`, updatedPoi);
    return c.json({ success: true, data: updatedPoi });
  } catch (error) {
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Reset ALL POIs — admin only (IMPORTANT: defined BEFORE the :id route)
app.delete("/make-server-e51cba93/pois", safeHandler(async (c: any) => {
  if (!(await requireAdmin(c))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    console.log("🗑️ Reset endpoint called - fetching all POIs...");
    const pois = await kv.getByPrefix("poi:");
    const keys = pois.map((poi: any) => `poi:${poi.id}`);

    console.log(`📊 Found ${keys.length} POIs to delete`);
    if (keys.length > 0) {
      await kv.mdel(...keys);
      console.log(`✅ Successfully deleted ${keys.length} POIs`);
    }
    return c.json({ success: true, deletedCount: keys.length });
  } catch (error) {
    console.error("❌ Error resetting POIs:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Enrich a POI (altitude, water proximity) — rate-limited, no admin required
app.patch("/make-server-e51cba93/pois/:id/enrich", safeHandler(async (c: any) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(`enrich:${ip}`, 60)) {
    return c.json({ success: false, error: "Too many requests" }, 429);
  }

  try {
    const id = c.req.param("id");
    const raw = await c.req.json();

    const ALLOWED = new Set(["altitude", "waterProximity", "naturalWaterProximity"]);
    const updates = Object.fromEntries(
      Object.entries(raw).filter(([k]) => ALLOWED.has(k))
    );
    if (Object.keys(updates).length === 0) {
      return c.json({ success: false, error: "No valid enrichment fields" }, 400);
    }

    const existing = await kv.get(`poi:${id}`);
    if (!existing) {
      return c.json({ success: false, error: "POI not found" }, 404);
    }

    const updated = { ...existing, ...updates };
    await kv.set(`poi:${id}`, updated);
    console.log(`✅ POI ${id} enrichi (altitude: ${updated.altitude ?? 'N/A'}m, eau: ${updated.waterProximity ?? 'N/A'}, naturelle: ${updated.naturalWaterProximity ?? 'N/A'})`);
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error enriching POI:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Delete a single POI — admin only
app.delete("/make-server-e51cba93/pois/:id", safeHandler(async (c: any) => {
  if (!(await requireAdmin(c))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const id = c.req.param("id");
    console.log(`🗑️ Deleting POI with id: ${id}`);
    await kv.del(`poi:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting POI:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Altitude proxy — public read
app.get("/make-server-e51cba93/altitude", safeHandler(async (c: any) => {
  try {
    const lat = c.req.query("lat");
    const lng = c.req.query("lng");

    if (!lat || !lng) {
      return c.json({ success: false, error: "Missing lat/lng parameters" }, 400);
    }

    // Validate that lat/lng are finite numbers in valid ranges
    const latN = Number(lat);
    const lngN = Number(lng);
    if (!isFinite(latN) || latN < -90 || latN > 90 || !isFinite(lngN) || lngN < -180 || lngN > 180) {
      return c.json({ success: false, error: "Invalid lat/lng parameters" }, 400);
    }

    const response = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${latN}&longitude=${lngN}`,
      { headers: { 'User-Agent': 'bivouac-app/1.0' } }
    );

    if (!response.ok) {
      throw new Error(`Open-Meteo elevation error: ${response.status}`);
    }

    const data = await response.json();
    const altitude = data.elevation?.[0];

    if (altitude === undefined || altitude === null) {
      return c.json({ success: false, error: "No elevation data" }, 404);
    }

    console.log(`✅ Altitude: ${Math.round(altitude)}m pour (${latN}, ${lngN})`);
    return c.json({ success: true, altitude: Math.round(altitude) });
  } catch (error) {
    console.error("Error fetching altitude:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Overpass proxy — drinking water points
app.post("/make-server-e51cba93/water-points", safeHandler(async (c: any) => {
  try {
    const body = await c.req.json();

    let south: number, west: number, north: number, east: number;
    try {
      ({ south, west, north, east } = validateBounds(body));
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 400);
    }
    const timeout = validateTimeout(body.timeout);

    const query = `[out:json][timeout:${timeout}];(node["amenity"="drinking_water"]["access"!="private"](${south},${west},${north},${east});node["amenity"="water_point"]["access"!="private"](${south},${west},${north},${east});node["natural"="spring"]["access"!="private"](${south},${west},${north},${east});node["man_made"="water_well"]["access"!="private"](${south},${west},${north},${east}););out body qt;(way["natural"="water"]["access"!="private"](${south},${west},${north},${east});relation["natural"="water"]["access"!="private"](${south},${west},${north},${east}););out tags center qt;`;

    const ENDPOINTS = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.openstreetmap.ru/api/interpreter',
      'https://overpass.nchc.org.tw/api/interpreter',
    ];

    const HEADERS = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'bivouac-app/1.0 (contact: github.com/PierreGR01/bivouac)',
    };

    let lastError: string = 'No endpoint succeeded';
    for (const endpoint of ENDPOINTS) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30000);
      try {
        console.log(`🔍 Tentative Overpass: ${endpoint}`);
        const resp = await fetch(endpoint, {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: HEADERS,
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        console.log(`📡 ${endpoint} → ${resp.status}`);
        if (resp.ok) {
          const data = await resp.json();
          console.log(`✅ Overpass proxy: ${(data.elements || []).length} éléments depuis ${endpoint}`);
          return c.json({ success: true, data });
        }
        const bodyText = await resp.text().catch(() => '');
        lastError = `HTTP ${resp.status} from ${endpoint}: ${bodyText.slice(0, 200)}`;
      } catch (err: any) {
        clearTimeout(timer);
        lastError = `${endpoint}: ${err?.message || 'fetch error'}`;
        console.warn(`⚠️ Overpass ${endpoint} erreur: ${lastError}`);
      }
    }

    console.error(`❌ Tous les endpoints Overpass ont échoué`);
    return c.json({ success: false, error: 'All Overpass endpoints failed' }, 503);
  } catch (error) {
    console.error("Error proxying Overpass:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Overpass proxy — streams/rivers for proximity calculation
app.post("/make-server-e51cba93/stream-points", safeHandler(async (c: any) => {
  try {
    const body = await c.req.json();

    let south: number, west: number, north: number, east: number;
    try {
      ({ south, west, north, east } = validateBounds(body));
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 400);
    }

    const query = `[out:json][timeout:10];(way["waterway"~"^(stream|river|canal|ditch|drain|creek)$"]["access"!="private"](${south},${west},${north},${east}););out geom qt;`;
    const HEADERS = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'bivouac-app/1.0 (contact: github.com/PierreGR01/bivouac)',
    };
    const ENDPOINTS = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ];
    for (const endpoint of ENDPOINTS) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      try {
        const resp = await fetch(endpoint, { method: 'POST', body: `data=${encodeURIComponent(query)}`, headers: HEADERS, signal: ctrl.signal });
        clearTimeout(timer);
        if (resp.ok) {
          const data = await resp.json();
          return c.json({ success: true, data });
        }
      } catch (_err) { clearTimeout(timer); }
    }
    return c.json({ success: false, error: 'All endpoints failed' }, 503);
  } catch (error) {
    console.error("Error proxying stream-points:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Overpass proxy — protected areas
app.post("/make-server-e51cba93/protected-areas", safeHandler(async (c: any) => {
  try {
    const body = await c.req.json();

    let south: number, west: number, north: number, east: number;
    try {
      ({ south, west, north, east } = validateBounds(body));
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 400);
    }
    const timeout = validateTimeout(body.timeout, 90);

    const query = `[out:json][timeout:${timeout}][bbox:${south},${west},${north},${east}];(relation["boundary"="national_park"];relation["boundary"="protected_area"];relation["leisure"="nature_reserve"];way["leisure"="nature_reserve"];relation["designation"~"parc|réserve|arrêté|protected|park|reserve"];way["designation"~"parc|réserve|arrêté|protected|park|reserve"];relation["camping"~"no|forbidden|prohibited"];way["camping"~"no|forbidden|prohibited"];relation["bivouac"~"no|forbidden|prohibited"];way["bivouac"~"no|forbidden|prohibited"];);out geom;`;

    const ENDPOINTS = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.openstreetmap.ru/api/interpreter',
      'https://overpass.nchc.org.tw/api/interpreter',
    ];

    const HEADERS = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'bivouac-app/1.0 (contact: github.com/PierreGR01/bivouac)',
    };

    let lastError = 'No endpoint succeeded';
    for (const endpoint of ENDPOINTS) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), (timeout + 5) * 1000);
      try {
        console.log(`🔍 Zones protégées: ${endpoint}`);
        const resp = await fetch(endpoint, {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: HEADERS,
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        console.log(`📡 ${endpoint} → ${resp.status}`);
        if (resp.ok) {
          const data = await resp.json();
          console.log(`✅ Zones protégées proxy: ${(data.elements || []).length} éléments depuis ${endpoint}`);
          return c.json({ success: true, data });
        }
        lastError = `HTTP ${resp.status} from ${endpoint}`;
      } catch (err: any) {
        clearTimeout(timer);
        lastError = `${endpoint}: ${err?.message || 'fetch error'}`;
        console.warn(`⚠️ ${lastError}`);
      }
    }

    console.error(`❌ Tous les endpoints Overpass ont échoué`);
    return c.json({ success: false, error: 'All Overpass endpoints failed' }, 503);
  } catch (error) {
    console.error("Error proxying protected areas:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

app.onError((error: any, c: any) => {
  if (
    error?.code === 'EPIPE' ||
    error?.name === 'Http' ||
    error?.message?.includes('connection closed') ||
    error?.message?.includes('broken pipe')
  ) {
    console.log('ℹ️ Client a fermé la connexion (ignoré dans onError)');
    return new Response(null, { status: 499 });
  }
  console.error('❌ Erreur non gérée:', error);
  return c.json({ success: false, error: 'Internal server error' }, 500);
});

const serveSafe = async (request: Request) => {
  try {
    return await app.fetch(request);
  } catch (error: any) {
    if (
      error?.code === 'EPIPE' ||
      error?.name === 'Http' ||
      error?.message?.includes('connection closed') ||
      error?.message?.includes('broken pipe')
    ) {
      console.log('ℹ️ Client a fermé la connexion avant la réponse (ignoré au niveau serve)');
      return new Response(null, { status: 499 });
    }
    console.error('❌ Erreur fatale dans Deno.serve:', error);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

Deno.serve(serveSafe);
