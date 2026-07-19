import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { fetchTrips, createTrip, deleteTrip, Trip, TripInput } from '../../utils/supabase/trips-api';

export function useTrips() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['trips', currentUser?.id],
    queryFn: fetchTrips,
    enabled: !!currentUser,
  });

  const saveTrip = async (input: TripInput): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      const trip = await createTrip(input);
      if (trip) {
        queryClient.setQueryData<Trip[]>(['trips', currentUser.id], (old = []) => [trip, ...old]);
      }
      toast.success('Itinéraire enregistré');
      return true;
    } catch (error) {
      console.error('Error saving trip:', error);
      toast.error("Impossible d'enregistrer l'itinéraire");
      return false;
    }
  };

  const removeTrip = async (id: string): Promise<boolean> => {
    if (!currentUser) return false;
    try {
      await deleteTrip(id);
      queryClient.setQueryData<Trip[]>(['trips', currentUser.id], (old = []) => old.filter(t => t.id !== id));
      return true;
    } catch (error) {
      console.error('Error deleting trip:', error);
      toast.error("Impossible de supprimer l'itinéraire");
      return false;
    }
  };

  return {
    trips: query.data ?? [],
    isLoading: query.isLoading,
    saveTrip,
    removeTrip,
  };
}
