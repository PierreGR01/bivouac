import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";

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
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return false;
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
app.use(
  "/*",
  cors({
    origin: Deno.env.get("ALLOWED_ORIGIN") || "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

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

// Create a new POI — rate-limited
app.post("/make-server-e51cba93/pois", safeHandler(async (c: any) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(`create:${ip}`, 20)) {
    return c.json({ success: false, error: "Too many requests" }, 429);
  }

  try {
    const body = await c.req.json();
    const { id, title, description, photos, season, waterProximity, regulations, position, altitude, capacity, difficulty, ratings } = body;

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

// Add a rating — rate-limited
app.post("/make-server-e51cba93/pois/:id/rate", safeHandler(async (c: any) => {
  const ip = c.req.header("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (!checkRateLimit(`rate:${ip}`, 30)) {
    return c.json({ success: false, error: "Too many requests" }, 429);
  }

  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { rating } = body;

    if (typeof rating !== 'number' || rating < 0 || rating > 5) {
      return c.json({ success: false, error: "Rating must be a number between 0 and 5" }, 400);
    }

    const poi = await kv.get(`poi:${id}`);
    if (!poi) {
      return c.json({ success: false, error: "POI not found" }, 404);
    }

    const updatedPoi = { ...poi, ratings: [...(poi.ratings || []), rating] };
    await kv.set(`poi:${id}`, updatedPoi);
    console.log(`✅ Note ajoutée au POI ${id}: ${rating}/5`);
    return c.json({ success: true, data: updatedPoi });
  } catch (error) {
    console.error("Error adding rating:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Reset ALL POIs — admin only (defined BEFORE :id route)
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

    const query = `
      [out:json][timeout:${timeout}][maxsize:536870912];
      (
        node["amenity"="drinking_water"](${south},${west},${north},${east});
        node["amenity"="water_point"](${south},${west},${north},${east});
        node["natural"="spring"](${south},${west},${north},${east});
        node["man_made"="water_well"](${south},${west},${north},${east});
      );
      out body qt;
    `;

    const ENDPOINTS = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.openstreetmap.ru/api/interpreter',
    ];
    const HTTP_TIMEOUT = 30000;

    const tryEndpoint = async (endpoint: string): Promise<any> => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), HTTP_TIMEOUT);
      try {
        const resp = await fetch(endpoint, {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${endpoint}`);
        const data = await resp.json();
        console.log(`✅ Overpass proxy: ${(data.elements || []).length} éléments depuis ${endpoint}`);
        return data;
      } catch (err: any) {
        clearTimeout(timer);
        throw err;
      }
    };

    try {
      const data = await Promise.any(ENDPOINTS.map(tryEndpoint));
      return c.json({ success: true, data });
    } catch (err: any) {
      console.warn(`⚠️ Tous les endpoints Overpass ont échoué`);
      return c.json({ success: false, error: 'All Overpass endpoints failed' }, 502);
    }
  } catch (error) {
    console.error("Error proxying Overpass:", error);
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
