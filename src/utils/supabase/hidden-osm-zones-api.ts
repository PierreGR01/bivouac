import { supabaseClient } from './client';

export async function fetchHiddenOsmZoneIds(): Promise<string[]> {
  try {
    const { data, error } = await supabaseClient
      .from('hidden_osm_zones')
      .select('osm_id');
    if (error) throw error;
    return data?.map((r: any) => r.osm_id) ?? [];
  } catch {
    return [];
  }
}

export async function hideOsmZone(osmId: string): Promise<void> {
  const session = await supabaseClient.auth.getSession();
  const userId = session.data.session?.user.id;
  const { error } = await supabaseClient
    .from('hidden_osm_zones')
    .insert({ osm_id: osmId, hidden_by: userId });
  if (error) throw error;
}
