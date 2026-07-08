// Point-in-polygon contre une géométrie de territoire (admin_zones). Miroir côté client
// de la même logique côté serveur (supabase/functions/make-server-e51cba93/index.ts,
// isPointInZoneGeometry) — utilisée ici pour scoper la liste de spots du dashboard admin
// à un admin de zone sans faire d'aller-retour serveur dédié.

interface Point {
  lat: number;
  lng: number;
}

function isPointInRing(point: Point, ring: number[][]): boolean {
  const n = ring.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = ((yi > point.lat) !== (yj > point.lat))
      && (point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isPointInZoneGeometry(point: Point, geometry: GeoJSON.Feature | GeoJSON.Geometry | null | undefined): boolean {
  if (!geometry) return false;
  const raw = geometry as any;
  const geom = raw.type === 'Feature' ? raw.geometry : raw;
  if (!geom) return false;

  if (geom.type === 'Polygon') {
    return isPointInRing(point, geom.coordinates[0]);
  }
  if (geom.type === 'MultiPolygon') {
    return geom.coordinates.some((poly: number[][][]) => isPointInRing(point, poly[0]));
  }
  return false;
}

export function isPointInAnyZone(point: Point, geometries: Array<GeoJSON.Feature | GeoJSON.Geometry>): boolean {
  return geometries.some((geometry) => isPointInZoneGeometry(point, geometry));
}
