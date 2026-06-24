import { supabaseClient } from './client';

export interface HiddenOsmZone {
  id: string;
  name?: string;
}

export async function fetchHiddenOsmZones(): Promise<HiddenOsmZone[]> {
  try {
    const { data, error } = await supabaseClient
      .from('hidden_osm_zones')
      .select('osm_id, osm_name');
    if (error) throw error;
    return data?.map((r: any) => ({ id: r.osm_id, name: r.osm_name ?? undefined })) ?? [];
  } catch {
    return [];
  }
}

export async function fetchHiddenOsmZoneIds(): Promise<string[]> {
  const zones = await fetchHiddenOsmZones();
  return zones.map(z => z.id);
}

export async function hideOsmZone(osmId: string, osmName?: string): Promise<void> {
  const session = await supabaseClient.auth.getSession();
  const userId = session.data.session?.user.id;
  const { error } = await supabaseClient
    .from('hidden_osm_zones')
    .insert({ osm_id: osmId, hidden_by: userId, osm_name: osmName ?? null });
  if (error) throw error;
}
