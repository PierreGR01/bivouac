import { supabaseClient } from './client';

export interface WaterPointConfirmation {
  id: string;
  water_point_osm_id: string;
  is_valid: boolean;
  confirmed_on: string; // "YYYY-MM-DD"
  confirmed_by: string;
  created_at: string;
}

export async function fetchWaterPointConfirmations(osmId: string): Promise<WaterPointConfirmation[]> {
  try {
    const { data, error } = await supabaseClient
      .from('water_point_confirmations')
      .select('*')
      .eq('water_point_osm_id', osmId)
      .order('confirmed_on', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching water point confirmations:', error);
    return [];
  }
}

export async function createWaterPointConfirmation(
  osmId: string,
  isValid: boolean,
  confirmedOn: string
): Promise<WaterPointConfirmation> {
  const session = await supabaseClient.auth.getSession();
  const userId = session.data.session?.user.id;

  if (!userId) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabaseClient
    .from('water_point_confirmations')
    .insert([
      {
        water_point_osm_id: osmId,
        is_valid: isValid,
        confirmed_on: confirmedOn,
        confirmed_by: userId,
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}
