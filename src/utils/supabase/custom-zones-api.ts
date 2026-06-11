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
