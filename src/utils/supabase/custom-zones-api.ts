import { supabaseClient } from './client';

export interface CustomZone {
  id: string;
  name: string;
  description: string;
  geometry: GeoJSON.Feature;
  restriction_type: 'camping_forbidden' | 'bivouac_forbidden' | 'fire_forbidden' | 'other';
  seasons: string[]; // 'all_year', 'winter', 'summer', or specific dates
  source_url?: string;
  created_at: string;
  valid_from?: string;
  valid_until?: string;
  created_by: string;
  protection_level: 'strict' | 'moderate' | 'low';
}

export interface CustomZoneInput {
  name: string;
  description?: string;
  geometry: GeoJSON.Feature;
  restriction_type: 'camping_forbidden' | 'bivouac_forbidden' | 'fire_forbidden' | 'other';
  seasons: string[];
  source_url?: string;
  valid_from?: string;
  valid_until?: string;
  protection_level: 'strict' | 'moderate' | 'low';
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

// Create a new custom zone
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

// Update a custom zone
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

// Delete a custom zone
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

// Get a single custom zone
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
