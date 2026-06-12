import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import * as kv from "./kv_store.tsx";

// Gestionnaire global pour les erreurs non capturées de Deno
globalThis.addEventListener("error", (event) => {
  const error = event.error;
  // Ignorer silencieusement les erreurs de connexion fermée
  if (
    error?.code === 'EPIPE' || 
    error?.name === 'Http' || 
    error?.message?.includes('connection closed') ||
    error?.message?.includes('broken pipe')
  ) {
    event.preventDefault(); // Empêcher l'affichage de l'erreur
    return;
  }
  // Les autres erreurs seront affichées normalement
});

// Gestionnaire global pour les promesses rejetées non capturées
globalThis.addEventListener("unhandledrejection", (event) => {
  const error = event.reason;
  // Ignorer silencieusement les erreurs de connexion fermée
  if (
    error?.code === 'EPIPE' || 
    error?.name === 'Http' || 
    error?.message?.includes('connection closed') ||
    error?.message?.includes('broken pipe')
  ) {
    event.preventDefault(); // Empêcher l'affichage de l'erreur
    return;
  }
  // Les autres erreurs seront affichées normalement
});

const app = new Hono();

// Wrapper pour gérer les erreurs de connexion fermée (broken pipe)
const safeHandler = (handler: any) => async (c: any) => {
  try {
    return await handler(c);
  } catch (error: any) {
    // Ignorer les erreurs de connexion fermée/annulée
    if (
      error?.code === 'EPIPE' || 
      error?.name === 'Http' || 
      error?.message?.includes('connection closed') ||
      error?.message?.includes('broken pipe')
    ) {
      console.log('ℹ️ Client a fermé la connexion (ignoré)');
      // Ne pas essayer de répondre, la connexion est déjà fermée
      return new Response(null, { status: 499 }); // Client Closed Request
    }
    
    // Pour les autres erreurs, les loguer et renvoyer une réponse d'erreur
    console.error('❌ Erreur serveur:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
};

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-e51cba93/health", safeHandler((c: any) => {
  return c.json({ status: "ok" });
}));

// Get all POI locations
app.get("/make-server-e51cba93/pois", safeHandler(async (c: any) => {
  try {
    const pois = await kv.getByPrefix("poi:");
    return c.json({ success: true, data: pois });
  } catch (error) {
    console.error("Error fetching POIs:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
}));

// Create a new POI location
app.post("/make-server-e51cba93/pois", safeHandler(async (c: any) => {
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
      waterProximity, // proche | éloigné | null
      regulations,
      position,
      altitude, // Altitude en mètres
      capacity, // '1' | '2-3' | '4-5' | '5+'
      difficulty, // 0-5
      ratings: ratings || [], // Array de notes 0-5
      createdAt: new Date().toISOString(),
    };

    await kv.set(`poi:${id}`, poi);
    console.log(`✅ POI créé avec altitude: ${altitude || 'N/A'}m, capacité: ${capacity || 'N/A'}, difficulté: ${difficulty || 'N/A'}`);
    return c.json({ success: true, data: poi });
  } catch (error) {
    console.error("Error creating POI:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
}));

// Add a rating to a POI
app.post("/make-server-e51cba93/pois/:id/rate", safeHandler(async (c: any) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { rating } = body;

    if (typeof rating !== 'number' || rating < 0 || rating > 5) {
      return c.json({ success: false, error: "Rating must be a number between 0 and 5" }, 400);
    }

    // Récupérer le POI existant
    const poi = await kv.get(`poi:${id}`);
    
    if (!poi) {
      return c.json({ success: false, error: "POI not found" }, 404);
    }

    // Ajouter la note
    const updatedPoi = {
      ...poi,
      ratings: [...(poi.ratings || []), rating]
    };

    await kv.set(`poi:${id}`, updatedPoi);
    console.log(`✅ Note ajoutée au POI ${id}: ${rating}/5`);
    return c.json({ success: true, data: updatedPoi });
  } catch (error) {
    console.error("Error adding rating:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
}));

// Reset all POIs (delete all POIs from the database)
// IMPORTANT: Cette route doit être définie AVANT la route avec paramètre :id
app.delete("/make-server-e51cba93/pois", safeHandler(async (c: any) => {
  try {
    console.log("🗑️ Reset endpoint called - fetching all POIs...");
    const pois = await kv.getByPrefix("poi:");
    const keys = pois.map((poi: any) => `poi:${poi.id}`);
    
    console.log(`📊 Found ${keys.length} POIs to delete`);
    
    if (keys.length > 0) {
      await kv.mdel(...keys);
      console.log(`✅ Successfully deleted ${keys.length} POIs`);
    } else {
      console.log("ℹ️ No POIs to delete");
    }
    
    return c.json({ success: true, deletedCount: keys.length });
  } catch (error) {
    console.error("❌ Error resetting POIs:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
}));

// Delete a POI location (optional for future use)
app.delete("/make-server-e51cba93/pois/:id", safeHandler(async (c: any) => {
  try {
    const id = c.req.param("id");
    console.log(`🗑️ Deleting POI with id: ${id}`);
    await kv.del(`poi:${id}`);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting POI:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
}));

// Proxy Overpass API — évite les erreurs CORS depuis le navigateur
app.post("/make-server-e51cba93/water-points", safeHandler(async (c: any) => {
  try {
    const body = await c.req.json();
    const { south, west, north, east, timeout = 30 } = body;

    if (south === undefined || west === undefined || north === undefined || east === undefined) {
      return c.json({ success: false, error: "Missing bounds: south, west, north, east" }, 400);
    }

    const query = `[out:json][timeout:${timeout}];(node["amenity"="drinking_water"](${south},${west},${north},${east});node["amenity"="water_point"](${south},${west},${north},${east});node["natural"="spring"](${south},${west},${north},${east});node["man_made"="water_well"](${south},${west},${north},${east}););out body qt;`;

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
        lastError = `${endpoint}: ${err?.message || String(err)}`;
        console.warn(`⚠️ Overpass ${endpoint} erreur: ${lastError}`);
      }
    }

    console.error(`❌ Tous les endpoints Overpass ont échoué: ${lastError}`);
    return c.json({ success: false, error: lastError }, 503);
  } catch (error) {
    console.error("Error proxying Overpass:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
}));

// Proxy Overpass API — zones protégées (parcs, réserves, arrêtés)
app.post("/make-server-e51cba93/protected-areas", safeHandler(async (c: any) => {
  try {
    const body = await c.req.json();
    const { south, west, north, east, timeout = 60 } = body;

    if (south === undefined || west === undefined || north === undefined || east === undefined) {
      return c.json({ success: false, error: "Missing bounds: south, west, north, east" }, 400);
    }

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
        lastError = `${endpoint}: ${err?.message || String(err)}`;
        console.warn(`⚠️ ${lastError}`);
      }
    }

    console.error(`❌ Tous les endpoints Overpass ont échoué: ${lastError}`);
    return c.json({ success: false, error: lastError }, 503);
  } catch (error) {
    console.error("Error proxying protected areas:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
}));

// Gestionnaire d'erreurs global pour attraper toutes les erreurs non gérées
app.onError((error: any, c: any) => {
  // Ignorer silencieusement les erreurs de connexion fermée
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
  return c.json({ success: false, error: 'Internal Server Error' }, 500);
});

// Wrapper pour Deno.serve qui gère les erreurs de broken pipe
const serveSafe = async (request: Request) => {
  try {
    return await app.fetch(request);
  } catch (error: any) {
    // Ignorer les erreurs de connexion fermée au niveau le plus haut
    if (
      error?.code === 'EPIPE' || 
      error?.name === 'Http' || 
      error?.message?.includes('connection closed') ||
      error?.message?.includes('broken pipe')
    ) {
      console.log('ℹ️ Client a fermé la connexion avant la réponse (ignoré au niveau serve)');
      // Retourner une réponse vide - de toute façon le client ne la recevra pas
      return new Response(null, { status: 499 });
    }
    
    // Pour les autres erreurs, les loguer et retourner 500
    console.error('❌ Erreur fatale dans Deno.serve:', error);
    return new Response(JSON.stringify({ success: false, error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

Deno.serve(serveSafe);