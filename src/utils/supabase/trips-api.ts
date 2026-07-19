import { supabaseClient } from './client';

export interface Trip {
  id: string;
  user_id: string;
  name: string;
  points: Array<{ lat: number; lng: number }>;
  source: 'drawn' | 'import';
  created_at: string;
}

export interface TripInput {
  name: string;
  points: Array<{ lat: number; lng: number }>;
  source: 'drawn' | 'import';
}

export async function fetchTrips(): Promise<Trip[]> {
  const { data, error } = await supabaseClient
    .from('trips')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching trips:', error);
    return [];
  }
  return data || [];
}

export async function createTrip(trip: TripInput): Promise<Trip | null> {
  const session = await supabaseClient.auth.getSession();
  const userId = session.data.session?.user.id;
  if (!userId) throw new Error('User not authenticated');

  const { data, error } = await supabaseClient
    .from('trips')
    .insert([{ ...trip, user_id: userId }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTrip(id: string): Promise<void> {
  const { error } = await supabaseClient
    .from('trips')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
