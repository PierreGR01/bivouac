import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { fetchFavoritePoiIds, addFavorite, removeFavorite } from '../../utils/supabase/favorites-api';

export function useFavorites() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['favorites', currentUser?.id],
    queryFn: fetchFavoritePoiIds,
    enabled: !!currentUser,
  });

  const favoriteIds = useMemo(() => new Set(query.data ?? []), [query.data]);

  const toggleFavorite = async (poiId: string) => {
    if (!currentUser) return;
    const isFav = favoriteIds.has(poiId);
    try {
      if (isFav) {
        await removeFavorite(poiId);
        queryClient.setQueryData<string[]>(['favorites', currentUser.id], (old = []) => old.filter(id => id !== poiId));
      } else {
        await addFavorite(poiId);
        queryClient.setQueryData<string[]>(['favorites', currentUser.id], (old = []) => [...old, poiId]);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Impossible de mettre à jour les favoris');
    }
  };

  return {
    favoriteIds,
    isFavorite: (poiId: string) => favoriteIds.has(poiId),
    toggleFavorite,
  };
}
