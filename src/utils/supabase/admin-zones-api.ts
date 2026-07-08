import { supabaseClient } from './client';

export interface AdminZone {
  id: string;
  name: string;
  description: string;
  geometry: GeoJSON.Feature;
  source_url?: string;
  created_at: string;
  created_by: string;
}

export interface AdminZoneInput {
  name: string;
  description?: string;
  geometry: GeoJSON.Feature;
  source_url?: string;
}

export async function fetchAdminZones(): Promise<AdminZone[]> {
  try {
    const { data, error } = await supabaseClient
      .from('admin_zones')
      .select('*');

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching admin zones:', error);
    return [];
  }
}

export async function getAdminZone(id: string): Promise<AdminZone | null> {
  try {
    const { data, error } = await supabaseClient
      .from('admin_zones')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching admin zone:', error);
    return null;
  }
}

export async function createAdminZone(zone: AdminZoneInput): Promise<AdminZone | null> {
  const session = await supabaseClient.auth.getSession();
  const userId = session.data.session?.user.id;

  if (!userId) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabaseClient
    .from('admin_zones')
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
}

export async function updateAdminZone(id: string, zone: Partial<AdminZoneInput>): Promise<void> {
  const { data, error } = await supabaseClient
    .from('admin_zones')
    .update(zone)
    .eq('id', id)
    .select('id');

  if (error) throw error;
  if (!data || data.length === 0) throw new Error(`Mise à jour refusée — vérifier les permissions (id: ${id})`);
}

export async function deleteAdminZone(id: string): Promise<void> {
  const { error } = await supabaseClient
    .from('admin_zones')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
