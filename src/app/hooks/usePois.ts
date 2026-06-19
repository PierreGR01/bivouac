import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PoiLocation } from '../types';
import { mockLocations } from '../data';
import { migratePois } from '../utils/poi-migration';
import { calculateWaterProximity, calculateNaturalWaterProximity } from '../utils/water-proximity';
import { fetchWaterPoints, fetchNearbyStreams } from '../services/overpass';
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

      // Sauvegarde immédiate sans attendre les données eau/altitude
      const poiWithId: PoiLocation = {
        id: `poi-${Date.now()}`,
        ...newPoi,
        waterProximity: null,
        naturalWaterProximity: null,
        altitude: null,
      };

      const success = await api.createPoi(poiWithId);
      setServerAvailable(success);

      if (success) {
        toast.success('Point de bivouac enregistré ! Il est maintenant accessible à tous.');
      } else {
        toast.warning('Point ajouté localement. Le serveur n\'est pas disponible.');
      }

      // Enrichissement eau/altitude en arrière-plan (ne bloque pas l'UX)
      const radius = WATER_LOADING_RADIUS_DEG;
      const bounds = {
        south: newPoi.position.lat - radius,
        west: newPoi.position.lng - radius,
        north: newPoi.position.lat + radius,
        east: newPoi.position.lng + radius,
      };

      Promise.all([
        api.fetchAltitude(newPoi.position.lat, newPoi.position.lng).catch(() => null),
        waterPoints.length > 0
          ? Promise.resolve(waterPoints)
          : fetchWaterPoints(bounds, 15).catch(() => []),
        fetchNearbyStreams(newPoi.position.lat, newPoi.position.lng, radius).catch(() => []),
      ]).then(([altitude, localWaterPoints, nearbyStreams]) => {
        const allWaterPoints = [...(localWaterPoints as any[]), ...(nearbyStreams as any[])];
        const enriched: Partial<PoiLocation> = {
          altitude,
          waterProximity: calculateWaterProximity(newPoi.position!.lat, newPoi.position!.lng, allWaterPoints),
          naturalWaterProximity: calculateNaturalWaterProximity(newPoi.position!.lat, newPoi.position!.lng, allWaterPoints),
        };
        devLog.log(`🏔️ Enrichissement: altitude=${altitude}m, eau=${enriched.waterProximity}, naturelle=${enriched.naturalWaterProximity}`);

        // Mise à jour du cache local + selectedLocation si le spot est ouvert
        queryClient.setQueryData<PoiLocation[]>(['pois'], (old = []) =>
          old.map(p => p.id === poiWithId.id ? { ...p, ...enriched } : p)
        );
        setSelectedLocation(prev =>
          prev?.id === poiWithId.id ? { ...prev, ...enriched } : prev
        );

        // Mise à jour persistante sur le serveur (fire-and-forget, sans auth admin)
        api.enrichPoi(poiWithId.id, enriched).catch(() => {
          devLog.log('⚠️ Mise à jour enrichissement échouée (ignorée)');
        });
      }).catch(() => {
        devLog.log('⚠️ Enrichissement eau/altitude échoué (ignoré)');
      });

      return poiWithId;
    },

    onSuccess: (poi) => {
      queryClient.setQueryData<PoiLocation[]>(['pois'], (old = []) => [...old, poi]);
      setSelectedLocation(poi);
    },

    onError: (error: any) => {
      const msg = error?.message || '';
      const isUserFacing = msg.includes('Coordonnées') || msg.includes('Création impossible');
      const message = isUserFacing ? msg : 'Impossible d\'enregistrer le point. Réessayez.';
      toast.error(message);
      setServerAvailable(false);
    },
  });

  const selectLocation = useCallback((loc: PoiLocation | null) => {
    setSelectedLocation(loc);
    if (!loc) return;

    // Re-enrich altitude if missing
    if (loc.altitude === null || loc.altitude === undefined) {
      api.fetchAltitude(loc.position.lat, loc.position.lng)
        .then(altitude => {
          if (altitude == null) return;
          setSelectedLocation(prev => prev?.id === loc.id ? { ...prev, altitude } : prev);
          queryClient.setQueryData<PoiLocation[]>(['pois'], (old = []) =>
            old.map(p => p.id === loc.id ? { ...p, altitude } : p)
          );
          api.enrichPoi(loc.id, { altitude }).catch(() => {});
        });
    }

    // Re-enrich water proximity if both fields are still null (enrichment never persisted)
    if (loc.waterProximity === null || loc.waterProximity === undefined) {
      const radius = WATER_LOADING_RADIUS_DEG;
      const bounds = {
        south: loc.position.lat - radius,
        west: loc.position.lng - radius,
        north: loc.position.lat + radius,
        east: loc.position.lng + radius,
      };
      Promise.all([
        fetchWaterPoints(bounds, 15).catch(() => []),
        fetchNearbyStreams(loc.position.lat, loc.position.lng, radius).catch(() => []),
      ]).then(([localWaterPoints, nearbyStreams]) => {
        const allWaterPoints = [...(localWaterPoints as any[]), ...(nearbyStreams as any[])];
        const waterProximity = calculateWaterProximity(loc.position.lat, loc.position.lng, allWaterPoints);
        const naturalWaterProximity = calculateNaturalWaterProximity(loc.position.lat, loc.position.lng, allWaterPoints);
        const enriched = { waterProximity, naturalWaterProximity };
        setSelectedLocation(prev => prev?.id === loc.id ? { ...prev, ...enriched } : prev);
        queryClient.setQueryData<PoiLocation[]>(['pois'], (old = []) =>
          old.map(p => p.id === loc.id ? { ...p, ...enriched } : p)
        );
        api.enrichPoi(loc.id, enriched).catch(() => {});
      }).catch(() => {});
    }
  }, [queryClient]);

  return {
    locations: query.data ?? [],
    selectedLocation,
    setSelectedLocation: selectLocation,
    isLoading: query.isLoading,
    isSaving: mutation.isPending,
    serverAvailable,
    submitPoi: (newPoi: NewPoi, waterPoints: any[], onSuccess: (poi: PoiLocation) => void) => {
      mutation.mutate({ newPoi, waterPoints }, { onSuccess });
    },
  };
}
