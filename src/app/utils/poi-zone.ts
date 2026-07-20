// Validation de la zone optionnelle associée à un spot (polygone complémentaire au point,
// cf. isPointInZoneGeometry dans zone-geometry.ts pour la même logique de containment que
// les territoires admin). Miroir de la validation appliquée côté serveur
// (supabase/functions/make-server-e51cba93/index.ts) pour qu'une requête forgée ne puisse
// pas contourner la contrainte de surface/containment.

import { isPointInZoneGeometry } from './zone-geometry';

export const MAX_POI_ZONE_AREA_M2 = 150;

const METERS_PER_DEGREE_LAT = 111_320;

function ringCoordinates(geometry: GeoJSON.Feature | GeoJSON.Geometry | null | undefined): number[][] | null {
  if (!geometry) return null;
  const raw = geometry as any;
  const geom = raw.type === 'Feature' ? raw.geometry : raw;
  if (!geom) return null;
  if (geom.type === 'Polygon') return geom.coordinates[0] ?? null;
  if (geom.type === 'MultiPolygon') return geom.coordinates[0]?.[0] ?? null;
  return null;
}

// Projection équirectangulaire autour de la latitude moyenne de l'anneau, puis formule du
// lacet (shoelace) sur les coordonnées projetées en mètres. Précis à cette échelle (≤150 m²).
export function computeAreaM2(geometry: GeoJSON.Feature | GeoJSON.Geometry | null | undefined): number {
  const ring = ringCoordinates(geometry);
  if (!ring || ring.length < 3) return 0;

  const avgLatRad = (ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length) * (Math.PI / 180);
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(avgLatRad);

  const projected = ring.map(([lng, lat]) => [lng * metersPerDegreeLng, lat * METERS_PER_DEGREE_LAT]);

  let area = 0;
  for (let i = 0; i < projected.length; i++) {
    const [x1, y1] = projected[i];
    const [x2, y2] = projected[(i + 1) % projected.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

export interface PoiZoneValidation {
  valid: boolean;
  reason?: 'too_large' | 'point_outside';
  areaM2?: number;
}

export function isValidPoiZone(
  position: { lat: number; lng: number },
  geometry: GeoJSON.Feature | GeoJSON.Geometry | null | undefined
): PoiZoneValidation {
  if (!isPointInZoneGeometry(position, geometry)) {
    return { valid: false, reason: 'point_outside' };
  }
  const areaM2 = computeAreaM2(geometry);
  if (areaM2 > MAX_POI_ZONE_AREA_M2) {
    return { valid: false, reason: 'too_large', areaM2 };
  }
  return { valid: true, areaM2 };
}
