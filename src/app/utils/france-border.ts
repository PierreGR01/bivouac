// Contour de la France métropolitaine (+ Corse), utilisé pour "cropper" le fond de carte
// SCAN25 IGN à la frontière et afficher OpenTopoMap au-delà (voir ign-topo-layer.ts).
// Source : data.gouv.fr / gregoiredavid/france-geojson (dérivé IGN ADMIN-EXPRESS, licence ouverte).

export type LonLat = [number, number];
export type Ring = LonLat[];
export type Polygon = Ring[]; // ring[0] = extérieur, rings suivants = trous

export type Bbox = { minLon: number; minLat: number; maxLon: number; maxLat: number };

interface RingWithBbox {
  ring: Ring;
  bbox: Bbox;
}

interface PolygonWithBbox {
  rings: RingWithBbox[];
}

export interface FranceBorder {
  polygons: PolygonWithBbox[];
  bbox: Bbox;
}

let cachedBorder: FranceBorder | null = null;
let loadPromise: Promise<FranceBorder | null> | null = null;

function ringBbox(ring: Ring): Bbox {
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLon, minLat, maxLon, maxLat };
}

function bboxIntersects(a: Bbox, b: Bbox): boolean {
  return a.minLon <= b.maxLon && a.maxLon >= b.minLon && a.minLat <= b.maxLat && a.maxLat >= b.minLat;
}

function bboxContainsPoint(b: Bbox, lon: number, lat: number): boolean {
  return lon >= b.minLon && lon <= b.maxLon && lat >= b.minLat && lat <= b.maxLat;
}

// Ray casting standard — chaque anneau (extérieur ou trou) inverse l'appartenance,
// ce qui gère les trous sans avoir à connaître leur orientation (règle even-odd).
function pointInRing(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Fetch + parse le contour (une seule fois, mis en cache en mémoire). */
export function loadFranceBorder(): Promise<FranceBorder | null> {
  if (cachedBorder) return Promise.resolve(cachedBorder);
  if (loadPromise) return loadPromise;

  loadPromise = fetch('/data/france-metropole.geojson')
    .then((res) => res.json())
    .then((geojson: { geometry: { coordinates: Polygon[] } }) => {
      const polygons: PolygonWithBbox[] = geojson.geometry.coordinates.map((polygon) => ({
        rings: polygon.map((ring) => ({ ring, bbox: ringBbox(ring) })),
      }));
      let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
      for (const p of polygons) {
        const b = p.rings[0].bbox;
        if (b.minLon < minLon) minLon = b.minLon;
        if (b.maxLon > maxLon) maxLon = b.maxLon;
        if (b.minLat < minLat) minLat = b.minLat;
        if (b.maxLat > maxLat) maxLat = b.maxLat;
      }
      cachedBorder = { polygons, bbox: { minLon, minLat, maxLon, maxLat } };
      return cachedBorder;
    })
    .catch(() => {
      // Fetch impossible (offline, 404...) — on désactive silencieusement le découpage,
      // le fond de carte reste utilisable (juste sans le crop précis aux frontières).
      cachedBorder = null;
      return null;
    });
  return loadPromise;
}

/** Version déjà chargée en mémoire, ou null si pas encore prête / indisponible. */
export function getFranceBorderSync(): FranceBorder | null {
  return cachedBorder;
}

export function isPointInFrance(border: FranceBorder, lon: number, lat: number): boolean {
  if (!bboxContainsPoint(border.bbox, lon, lat)) return false;
  for (const polygon of border.polygons) {
    const [exterior, ...holes] = polygon.rings;
    if (!bboxContainsPoint(exterior.bbox, lon, lat)) continue;
    if (!pointInRing(lon, lat, exterior.ring)) continue;
    const inHole = holes.some((h) => bboxContainsPoint(h.bbox, lon, lat) && pointInRing(lon, lat, h.ring));
    if (!inHole) return true;
  }
  return false;
}

export type TileClassification = 'inside' | 'outside' | 'border';

/**
 * Classe une tuile (par ses 4 coins lon/lat) par rapport à la frontière :
 * - 'outside' : hors de la bbox globale, ou 4 coins hors du polygone → pas de SCAN25 à charger
 * - 'inside'  : 4 coins dans le polygone → SCAN25 direct, pas de découpe nécessaire
 * - 'border'  : coins mixtes → la tuile chevauche la frontière, découpe précise nécessaire
 * Approximation : un fin éperon de frontière traversant la tuile sans toucher un coin
 * serait classé 'inside' ou 'outside' à tort — acceptable vu la taille d'une tuile.
 */
export function classifyTile(
  border: FranceBorder,
  tileBbox: Bbox
): TileClassification {
  if (!bboxIntersects(border.bbox, tileBbox)) return 'outside';

  const corners: LonLat[] = [
    [tileBbox.minLon, tileBbox.minLat],
    [tileBbox.maxLon, tileBbox.minLat],
    [tileBbox.minLon, tileBbox.maxLat],
    [tileBbox.maxLon, tileBbox.maxLat],
  ];
  let insideCount = 0;
  for (const [lon, lat] of corners) {
    if (isPointInFrance(border, lon, lat)) insideCount++;
  }
  if (insideCount === corners.length) return 'inside';
  if (insideCount === 0) return 'outside';
  return 'border';
}

/** Rings dont la bbox chevauche celle de la tuile — pour ne projeter/tracer que le nécessaire. */
export function relevantRingsForTile(
  border: FranceBorder,
  tileBbox: Bbox
): Array<{ ring: Ring; isHole: boolean }> {
  const result: Array<{ ring: Ring; isHole: boolean }> = [];
  for (const polygon of border.polygons) {
    const [exterior, ...holes] = polygon.rings;
    if (!bboxIntersects(exterior.bbox, tileBbox)) continue;
    result.push({ ring: exterior.ring, isHole: false });
    for (const h of holes) {
      if (bboxIntersects(h.bbox, tileBbox)) result.push({ ring: h.ring, isHole: true });
    }
  }
  return result;
}
