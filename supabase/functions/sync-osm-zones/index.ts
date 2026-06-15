import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

// Région Alpes françaises — doit correspondre à getAlpesRegionBounds() côté client
const ALPES_BOUNDS = { south: 44.5, west: 4.5, north: 46.3, east: 7.0 };

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

function buildQuery(bounds: typeof ALPES_BOUNDS): string {
  const { south, west, north, east } = bounds;
  return `
    [out:json][timeout:55][maxsize:52428800][bbox:${south},${west},${north},${east}];
    (
      relation["boundary"="national_park"];
      relation["leisure"="nature_reserve"];
      way["leisure"="nature_reserve"];
      relation["bivouac"~"no|forbidden|prohibited"];
      way["bivouac"~"no|forbidden|prohibited"];
      relation["camping"~"no|forbidden|prohibited"];
      way["camping"~"no|forbidden|prohibited"];
    );
    out geom;
  `;
}

function classifyArea(tags: Record<string, string>): {
  area_type: string;
  protection_level: string;
} {
  const designation = (tags.designation || "").toLowerCase();

  if (tags.boundary === "national_park") {
    return { area_type: "national_park", protection_level: "strict" };
  }
  if (tags.leisure === "nature_reserve") {
    return { area_type: "nature_reserve", protection_level: "strict" };
  }
  if (designation.includes("régional") || designation.includes("regional")) {
    return { area_type: "regional_park", protection_level: "moderate" };
  }
  if (designation.includes("natura")) {
    return { area_type: "natura2000", protection_level: "moderate" };
  }
  if (designation.includes("arrêté") || designation.includes("arrete")) {
    const level = designation.includes("camping") || designation.includes("bivouac")
      ? "strict"
      : "moderate";
    return { area_type: "prefectural_decree", protection_level: level };
  }
  if (tags.camping === "no" || tags.camping === "forbidden" || tags.bivouac === "no" || tags.bivouac === "forbidden") {
    return { area_type: "camping_restriction", protection_level: "strict" };
  }
  return { area_type: "protected_area", protection_level: "moderate" };
}

function parseElements(data: any): any[] {
  const results: any[] = [];
  if (!Array.isArray(data?.elements)) return results;

  for (const el of data.elements) {
    const tags: Record<string, string> = el.tags || {};

    let geometry: Array<{ lat: number; lng: number }> = [];

    if (el.type === "way" && el.geometry) {
      geometry = el.geometry.map((p: any) => ({ lat: p.lat, lng: p.lon }));
    } else if (el.type === "relation" && el.members) {
      for (const m of el.members) {
        if (m.role === "outer" && m.geometry) {
          geometry = geometry.concat(
            m.geometry.map((p: any) => ({ lat: p.lat, lng: p.lon }))
          );
        }
      }
    }

    if (geometry.length < 3) continue;

    const { area_type, protection_level } = classifyArea(tags);

    results.push({
      osm_id: `${el.type}-${el.id}`,
      name: tags.name || tags["name:fr"] || tags.protection_title || null,
      area_type,
      protection_level,
      tags,
      geometry,
    });
  }

  return results;
}

async function fetchFromOverpass(query: string): Promise<any> {
  const encoded = `data=${encodeURIComponent(query)}`;
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 130_000);
      const resp = await fetch(endpoint, {
        method: "POST",
        body: encoded,
        headers,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) continue;
      return await resp.json();
    } catch {
      // essaie le prochain endpoint
    }
  }
  throw new Error("Tous les endpoints Overpass ont échoué");
}

Deno.serve(async (req: Request) => {
  // Vérification du secret pour éviter les déclenchements non autorisés
  const secret = Deno.env.get("SYNC_SECRET");
  if (secret) {
    const auth = req.headers.get("Authorization") || "";
    if (auth !== `Bearer ${secret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    console.log("🔍 Récupération des zones OSM depuis Overpass...");
    const query = buildQuery(ALPES_BOUNDS);
    const data = await fetchFromOverpass(query);
    const zones = parseElements(data);
    console.log(`✅ ${zones.length} zones parsées`);

    if (zones.length === 0) {
      return new Response(
        JSON.stringify({ success: true, upserted: 0, message: "Aucune zone trouvée" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // Upsert par lots de 100
    let upserted = 0;
    for (let i = 0; i < zones.length; i += 100) {
      const batch = zones.slice(i, i + 100).map((z) => ({ ...z, synced_at: new Date().toISOString() }));
      const { error } = await supabase
        .from("osm_protected_areas")
        .upsert(batch, { onConflict: "osm_id" });
      if (error) {
        console.error(`❌ Erreur upsert lot ${i}:`, error);
      } else {
        upserted += batch.length;
      }
    }

    // Supprimer les zones qui n'existent plus dans OSM
    const currentIds = zones.map((z) => z.osm_id);
    const { error: deleteError } = await supabase
      .from("osm_protected_areas")
      .delete()
      .not("osm_id", "in", `(${currentIds.map((id) => `'${id}'`).join(",")})`);
    if (deleteError) {
      console.warn("⚠️ Nettoyage des anciennes zones échoué:", deleteError);
    }

    console.log(`✅ Sync terminé : ${upserted}/${zones.length} zones enregistrées`);
    return new Response(
      JSON.stringify({ success: true, upserted, total: zones.length }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("❌ Erreur sync:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
