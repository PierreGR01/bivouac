// Catalogue des massifs français couverts par un contour orographique réel et fiable :
// uniquement les relations OpenStreetMap boundary=natural / region:type=mountain_area
// (voir scripts/build-massifs-catalog.mjs). Le zonage administratif BRA de Météo-France
// a été écarté volontairement — trop grossier pour un usage de tracé précis (vérifié par
// point-in-polygon : Belledonne coupait Montgilbert/Rochebrune, Beaufortain excluait le
// Mont Joly) — et une donnée imprécise n'est pas un raccourci acceptable, donc les massifs
// sans équivalent OSM fiable (zones de vallée, Corse, Pyrénées) sont simplement absents du
// catalogue plutôt que représentés approximativement. Sert de liste prédéfinie pour la
// création rapide de zones d'administration, en complément du dessin/import libre.
export interface MassifCatalogEntry {
  id: string;
  name: string;
  region: string; // 'Alpes du Nord' | 'Alpes du Sud'
  sourceNote: string;
  geometry: GeoJSON.Feature;
}

let cache: MassifCatalogEntry[] | null = null;

interface RawMassifFeature {
  properties: { code: string; title: string; mountain: string; source_note: string };
  geometry: GeoJSON.Geometry;
}

export async function fetchMassifsCatalog(): Promise<MassifCatalogEntry[]> {
  if (cache) return cache;

  const response = await fetch('/data/massifs-alpins.geojson');
  if (!response.ok) throw new Error('Impossible de charger le catalogue des massifs');
  const data: { features: RawMassifFeature[] } = await response.json();

  cache = data.features.map((feature) => ({
    id: String(feature.properties.code),
    name: feature.properties.title as string,
    region: feature.properties.mountain as string,
    sourceNote: feature.properties.source_note as string,
    geometry: {
      type: 'Feature',
      properties: {},
      geometry: feature.geometry,
    } as GeoJSON.Feature,
  }));

  return cache;
}
