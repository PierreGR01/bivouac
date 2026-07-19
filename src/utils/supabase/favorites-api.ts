import { supabaseClient } from './client';

export async function fetchFavoritePoiIds(): Promise<string[]> {
  const session = await supabaseClient.auth.getSession();
  const userId = session.data.session?.user.id;
  if (!userId) return [];

  const { data, error } = await supabaseClient
    .from('favorites')
    .select('poi_id')
    .eq('user_id', userId);

  if (error) {
    console.error('Error fetching favorites:', error);
    return [];
  }
  return (data || []).map((row: { poi_id: string }) => row.poi_id);
}

export async function addFavorite(poiId: string): Promise<void> {
  const session = await supabaseClient.auth.getSession();
  const userId = session.data.session?.user.id;
  if (!userId) throw new Error('User not authenticated');

  const { error } = await supabaseClient
    .from('favorites')
    .insert([{ user_id: userId, poi_id: poiId }]);

  if (error) throw error;
}

export async function removeFavorite(poiId: string): Promise<void> {
  const session = await supabaseClient.auth.getSession();
  const userId = session.data.session?.user.id;
  if (!userId) throw new Error('User not authenticated');

  const { error } = await supabaseClient
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('poi_id', poiId);

  if (error) throw error;
}
