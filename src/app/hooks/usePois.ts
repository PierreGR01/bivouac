import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PoiLocation } from '../types';
import { mockLocations } from '../data';
import { migratePois } from '../utils/poi-migration';
import { calculateWaterProximity } from '../utils/water-proximity';
import { fetchWaterPoints } from '../services/overpass';
import { devLog } from '../utils/logger';
import { WATER_LOADING_RADIUS_DEG } from '../constants';
import * as api from '../../utils/supabase/api';
import { NewPoi } from '../components/AddPoiPanel';

async function fetchPois(): Promise<PoiLocation[]> {
  try {
    const pois = await api.fetchPois();
    const migrated = migratePois(pois);
    if (migrated.length === 0) {
      devLog.log('📌 Utilisation des données de démonstration');
      return mockLocations;
    }
    devLog.log(`✅ Chargé ${migrated.length} POI(s) depuis le serveur`);
    return migrated;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      devLog.log('ℹ️ Chargement des POIs annulé');
      return mockLocations;
    }
    console.error('❌ Erreur lors du chargement des POIs:', error);
    return mockLocations;
  }
}

interface SubmitPoiArgs {
  newPoi: NewPoi;
  waterPoints: any[];
}

export function usePois() {
  const queryClient = useQueryClient();
  const [selectedLocation, setSelectedLocation] = useState<PoiLocation | null>(null);
  const [serverAvailable, setServerAvailable] = useState(true);

  const query = useQuery({
    queryKey: ['pois'],
    queryFn: fetchPois,
  });

  const mutation = useMutation({
    mutationFn: async ({ newPoi, waterPoints }: SubmitPoiArgs): Promise<PoiLocation> => {
      if (
        !newPoi.position ||
        typeof newPoi.position.lat !== 'number' ||
        typeof newPoi.position.lng !== 'number' ||
        isNaN(newPoi.position.lat) ||
        isNaN(newPoi.position.lng)
      ) {
        throw new Error('Coordonnées invalides. Cliquez sur la carte pour définir une position.');
      }

      devLog.log('🏔️ Récupération de l\'altitude...');
      const altitude = await api.fetchAltitude(newPoi.position.lat, newPoi.position.lng).catch(() => {
        console.warn('⚠️ Impossible de récupérer l\'altitude');
        return null;
      });
      if (altitude !== null) devLog.log(`✅ Altitude récupérée: ${altitude}m`);

      let localWaterPoints = waterPoints;
      if (waterPoints.length === 0) {
        devLog.log('🔍 Chargement des points d\'eau autour du nouveau spot...');
        const radius = WATER_LOADING_RADIUS_DEG;
        const bounds = {
          south: newPoi.position.lat - radius,
          west: newPoi.position.lng - radius,
          north: newPoi.position.lat + radius,
          east: newPoi.position.lng + radius,
        };
        localWaterPoints = await fetchWaterPoints(bounds, 15).catch((error: any) => {
          console.warn('⚠️ Impossible de charger les points d\'eau:', error?.message || error);
          return [];
        });
        devLog.log(`✅ ${localWaterPoints.length} points d'eau trouvés`);
      }

      const waterProximity = calculateWaterProximity(
        newPoi.position.lat,
        newPoi.position.lng,
        localWaterPoints
      );

      const poiWithId: PoiLocation = {
        id: `poi-${Date.now()}`,
        ...newPoi,
        waterProximity,
        altitude,
      };

      const success = await api.createPoi(poiWithId);
      setServerAvailable(success);

      if (success) {
        toast.success('Point de bivouac enregistré ! Il est maintenant accessible à tous.');
      } else {
        toast.warning('Point ajouté localement. Le serveur n\'est pas disponible.');
      }

      return poiWithId;
    },

    onSuccess: (poi) => {
      queryClient.setQueryData<PoiLocation[]>(['pois'], (old = []) => [...old, poi]);
      setSelectedLocation(poi);
    },

    onError: (error: any) => {
      const message = error?.message?.includes('Coordonnées')
        ? error.message
        : 'Impossible d\'enregistrer le point. Réessayez.';
      toast.error(message);
      setServerAvailable(false);
    },
  });

  return {
    locations: query.data ?? [],
    selectedLocation,
    setSelectedLocation,
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    serverAvailable,
    submitPoi: (newPoi: NewPoi, waterPoints: any[], onSuccess: (poi: PoiLocation) => void) => {
      mutation.mutate({ newPoi, waterPoints }, { onSuccess });
    },
  };
}
