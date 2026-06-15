/**
 * Import des zones OSM protégées dans Supabase.
 * Usage : node scripts/sync-osm-zones.mjs
 */

const SUPABASE_URL = "https://fdzcdmyehllqvofysgdf.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error("❌ SUPABASE_SERVICE_KEY manquante. Relance avec :");
  console.error("   $env:SUPABASE_SERVICE_KEY='<ta-clé>' ; node scripts/sync-osm-zones.mjs");
  process.exit(1);
}

const BOUNDS = { south: 44.5, west: 4.5, north: 46.3, east: 7.0 };

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const QUERY = `
  [out:json][timeout:120][maxsize:52428800][bbox:${BOUNDS.south},${BOUNDS.west},${BOUNDS.north},${BOUNDS.east}];
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

function classifyArea(tags) {
  const designation = (tags.designation || "").toLowerCase();
  if (tags.boundary === "national_park") return { area_type: "national_park", protection_level: "strict" };
  if (tags.leisure === "nature_reserve") return { area_type: "nature_reserve", protection_level: "strict" };
  if (designation.includes("régional") || designation.includes("regional")) return { area_type: "regional_park", protection_level: "moderate" };
  if (designation.includes("natura")) return { area_type: "natura2000", protection_level: "moderate" };
  if (tags.bivouac === "no" || tags.bivouac === "forbidden" || tags.camping === "no" || tags.camping === "forbidden") return { area_type: "camping_restriction", protection_level: "strict" };
  return { area_type: "protected_area", protection_level: "moderate" };
}

function parseElements(data) {
  const results = [];
  for (const el of data.elements || []) {
    const tags = el.tags || {};
    let geometry = [];

    if (el.type === "way" && el.geometry) {
      geometry = el.geometry.map(p => ({ lat: p.lat, lng: p.lon }));
    } else if (el.type === "relation" && el.members) {
      for (const m of el.members) {
        if (m.role === "outer" && m.geometry) {
          geometry = geometry.concat(m.geometry.map(p => ({ lat: p.lat, lng: p.lon })));
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
      synced_at: new Date().toISOString(),
    });
  }
  return results;
}

async function fetchOverpass() {
  const params = new URLSearchParams({ data: QUERY });
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      console.log(`🌐 Tentative : ${endpoint}`);
      const resp = await fetch(endpoint, {
        method: "POST",
        body: params,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
          "User-Agent": "bivouac-app/1.0 (zone sync)",
        },
        signal: AbortSignal.timeout(130_000),
      });
      if (!resp.ok) {
        const errBody = await resp.text().catch(() => "");
        console.warn(`  ⚠️ HTTP ${resp.status} : ${errBody.slice(0, 200)}`);
        continue;
      }
      const data = await resp.json();
      console.log(`  ✅ ${(data.elements || []).length} éléments reçus`);
      return data;
    } catch (e) {
      console.warn(`  ⚠️ Échec : ${e.message}`);
    }
  }
  throw new Error("Tous les endpoints Overpass ont échoué");
}

async function upsertToSupabase(zones) {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
    "apikey": SUPABASE_SERVICE_KEY,
    "Prefer": "resolution=merge-duplicates",
  };

  let upserted = 0;
  for (let i = 0; i < zones.length; i += 100) {
    const batch = zones.slice(i, i + 100);
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/osm_protected_areas`, {
      method: "POST",
      headers,
      body: JSON.stringify(batch),
    });
    if (!resp.ok) {
      const err = await resp.text();
      console.error(`❌ Erreur lot ${i} : ${err}`);
    } else {
      upserted += batch.length;
      console.log(`  ✅ Lot ${i + 1}-${i + batch.length} enregistré`);
    }
  }
  return upserted;
}

async function deleteStale(currentIds) {
  const headers = {
    "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
    "apikey": SUPABASE_SERVICE_KEY,
  };
  const ids = currentIds.map(id => `"${id}"`).join(",");
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/osm_protected_areas?osm_id=not.in.(${ids})`, {
    method: "DELETE",
    headers,
  });
  if (!resp.ok) console.warn("⚠️ Nettoyage anciennes zones échoué");
  else console.log("🗑️ Anciennes zones supprimées");
}

(async () => {
  console.log("🔍 Récupération des zones OSM depuis Overpass...");
  const data = await fetchOverpass();
  const zones = parseElements(data);
  console.log(`\n📦 ${zones.length} zones parsées`);

  if (zones.length === 0) {
    console.log("Rien à importer.");
    process.exit(0);
  }

  console.log("\n⬆️  Import dans Supabase...");
  const upserted = await upsertToSupabase(zones);
  await deleteStale(zones.map(z => z.osm_id));

  console.log(`\n✅ Terminé : ${upserted}/${zones.length} zones importées`);
})();
