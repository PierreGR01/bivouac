import { supabaseClient } from './client';

export interface CustomZone {
  id: string;
  name: string;
  description: string;
  geometry: GeoJSON.Feature;
  restriction_types: string[]; // ['camping_forbidden', 'bivouac_forbidden', 'fire_forbidden']
  source_url?: string;
  created_at: string;
  created_by: string;
  time_range_start?: string; // HH:mm e.g. "09:00"
  time_range_end?: string;   // HH:mm e.g. "19:00"
  period_start?: string;     // dd/mm e.g. "01/05"
  period_end?: string;       // dd/mm e.g. "30/09"
}

export interface CustomZoneInput {
  name: string;
  description?: string;
  geometry: GeoJSON.Feature;
  restriction_types: string[];
  source_url?: string;
  time_range_start?: string;
  time_range_end?: string;
  period_start?: string;
  period_end?: string;
}

export async function fetchCustomZones(): Promise<CustomZone[]> {
  try {
    const { data, error } = await supabaseClient
      .from('custom_regulated_zones')
      .select('*');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching custom zones:', error);
    return [];
  }
}

export async function createCustomZone(zone: CustomZoneInput): Promise<CustomZone | null> {
  try {
    const session = await supabaseClient.auth.getSession();
    const userId = session.data.session?.user.id;

    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabaseClient
      .from('custom_regulated_zones')
      .insert([
        {
          ...zone,
          created_by: userId,
          created_at: new Date().toISOString(),
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating custom zone:', error);
    throw error;
  }
}

export async function updateCustomZone(id: string, zone: Partial<CustomZoneInput>): Promise<CustomZone | null> {
  try {
    const { data, error } = await supabaseClient
      .from('custom_regulated_zones')
      .update(zone)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating custom zone:', error);
    throw error;
  }
}

export async function deleteCustomZone(id: string): Promise<void> {
  try {
    const { error } = await supabaseClient
      .from('custom_regulated_zones')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting custom zone:', error);
    throw error;
  }
}

function isPointInGeoJSONRing(point: { lat: number; lng: number }, ring: number[][]): boolean {
  const n = ring.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > point.lat) !== (yj > point.lat))
      && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isPointInCustomZone(point: { lat: number; lng: number }, zone: CustomZone): boolean {
  const raw = zone.geometry as unknown;
  if (!raw) return false;

  // Supabase peut retourner soit un Feature GeoJSON, soit directement une géométrie
  let geom: GeoJSON.Geometry | null = null;
  const rawObj = raw as Record<string, unknown>;
  if (rawObj.type === 'Feature') {
    geom = (rawObj as GeoJSON.Feature).geometry as GeoJSON.Geometry;
  } else if (rawObj.type === 'Polygon' || rawObj.type === 'MultiPolygon') {
    geom = raw as GeoJSON.Geometry;
  }

  if (!geom) return false;

  if (geom.type === 'Polygon') {
    return isPointInGeoJSONRing(point, (geom as GeoJSON.Polygon).coordinates[0]);
  }
  if (geom.type === 'MultiPolygon') {
    return (geom as GeoJSON.MultiPolygon).coordinates.some(poly =>
      isPointInGeoJSONRing(point, poly[0])
    );
  }
  return false;
}

export function getZoneRestrictionStatus(
  point: { lat: number; lng: number },
  customZones: CustomZone[]
): { blocked: CustomZone[]; warnings: CustomZone[] } {
  const relevant = customZones.filter(z =>
    Array.isArray(z.restriction_types) && (
      z.restriction_types.includes('bivouac_forbidden') ||
      z.restriction_types.includes('camping_forbidden')
    )
  );
  const matching = relevant.filter(z => isPointInCustomZone(point, z));
  const hasSchedule = (z: CustomZone) =>
    !!(z.time_range_start || z.time_range_end || z.period_start || z.period_end);
  return {
    blocked: matching.filter(z => !hasSchedule(z)),
    warnings: matching.filter(z => hasSchedule(z)),
  };
}

export function formatZoneConstraints(zone: CustomZone): string {
  const parts: string[] = [];
  if (zone.period_start && zone.period_end) {
    parts.push(`du ${zone.period_start} au ${zone.period_end}`);
  }
  if (zone.time_range_start && zone.time_range_end) {
    parts.push(`de ${zone.time_range_start} à ${zone.time_range_end}`);
  }
  return parts.join(', ');
}

export async function getCustomZone(id: string): Promise<CustomZone | null> {
  try {
    const { data, error } = await supabaseClient
      .from('custom_regulated_zones')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching custom zone:', error);
    return null;
  }
}
