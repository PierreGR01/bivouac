import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PoiLocation } from '../types';
import { mockLocations } from '../data';
import { migratePois } from '../utils/poi-migration';
import { calculateWaterProximity, calculateNaturalWaterProximity } from '../utils/water-proximity';
import { fetchWaterPoints, fetchNearbyStreams } from '../services/overpass';
import { devLog } from '../utils/logger';
import { WATER_LOADING_RADIUS_DEG, DEFAULT_POIS_BBOX } from '../constants';
import * as api from '../../utils/supabase/api';
import { PoisBbox } from '../../utils/supabase/api';
import { NewPoi } from '../components/AddPoiPanel';

// Marge autour du viewport réel (évite de recharger au moindre pan/zoom) + arrondi à une
// grille de 0,05° (bornes de repli en dehors, pour ne jamais rétrécir la zone demandée) —
// stabilise la clé de cache react-query pour que de petits déplacements réutilisent le
// même résultat déjà en cache.
function expandAndRoundBbox(bbox: PoisBbox): PoisBbox {
  const latSpan = bbox.north - bbox.south;
  const lngSpan = bbox.east - bbox.west;
  const latMargin = Math.max(latSpan * 0.25, 0.02);
  const lngMargin = Math.max(lngSpan * 0.25, 0.02);
  const grid = 0.05;
  return {
    south: Math.floor((bbox.south - latMargin) / grid) * grid,
    west: Math.floor((bbox.west - lngMargin) / grid) * grid,
    north: Math.ceil((bbox.north + latMargin) / grid) * grid,
    east: Math.ceil((bbox.east + lngMargin) / grid) * grid,
  };
}

async function fetchPois(bbox: PoisBbox): Promise<PoiLocation[]> {
  try {
    const pois = await api.fetchPois(bbox);
    const migrated = migratePois(pois);
    devLog.log(`✅ Chargé ${migrated.length} POI(s) depuis le serveur`);
    return migrated;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      devLog.log('ℹ️ Chargement des POIs annulé');
      return mockLocations;
    }
    console.error('❌ Erreur lors du chargement des POIs:', error);
    devLog.log('📌 Utilisation des données de démonstration (échec du chargement)');
    return mockLocations;
  }
}

interface SubmitPoiArgs {
  newPoi: NewPoi;
  waterPoints: any[];
}

// Bounds bruts de la carte (mis à jour à chaque `moveend`, non débounced à la source —
// cf. useMapLayers) ; `null` tant qu'aucun `moveend` n'a encore été reçu.
export function usePois(mapBounds?: PoisBbox | null) {
  const queryClient = useQueryClient();
  const [selectedLocation, setSelectedLocation] = useState<PoiLocation | null>(null);
  const [serverAvailable, setServerAvailable] = useState(true);

  // Débounce ~400ms avant de répercuter un nouveau bbox sur la query — sinon un pan
  // continu déclencherait un fetch à chaque frame de `moveend`.
  const [debouncedBounds, setDebouncedBounds] = useState<PoisBbox>(DEFAULT_POIS_BBOX);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!mapBounds) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => setDebouncedBounds(mapBounds), 400);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [mapBounds]);

  const effectiveBbox = expandAndRoundBbox(debouncedBounds);

  const query = useQuery({
    queryKey: ['pois', effectiveBbox],
    queryFn: () => fetchPois(effectiveBbox),
    placeholderData: keepPreviousData,
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
        queryClient.setQueriesData<PoiLocation[]>({ queryKey: ['pois'] }, (old = []) =>
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
      queryClient.setQueriesData<PoiLocation[]>({ queryKey: ['pois'] }, (old = []) => [...old, poi]);
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

    // Analytics "vues 30j" du dashboard admin — fire-and-forget, une fois par ouverture.
    api.recordPoiView(loc.id).catch(() => {});

    // GET /pois (liste) ne renvoie que des champs légers — `description` n'existe que
    // sur un objet déjà enrichi du détail complet. Si absent, on va chercher photos/
    // reviews/regulations/zoneGeometry et on les injecte dans le spot ouvert ET dans
    // le cache de la liste (pour ne refaire ce fetch qu'une fois par spot).
    if (loc.description === undefined) {
      api.fetchPoiDetail(loc.id).then(detail => {
        if (!detail) return;
        setSelectedLocation(prev => prev?.id === loc.id ? { ...prev, ...detail } : prev);
        queryClient.setQueriesData<PoiLocation[]>({ queryKey: ['pois'] }, (old = []) =>
          old.map(p => p.id === loc.id ? { ...p, ...detail } : p)
        );
      }).catch(() => {
        devLog.log('⚠️ Détail du spot introuvable (ignoré)');
      });
    }

    // Re-enrich altitude if missing
    if (loc.altitude === null || loc.altitude === undefined) {
      api.fetchAltitude(loc.position.lat, loc.position.lng)
        .then(altitude => {
          if (altitude == null) return;
          setSelectedLocation(prev => prev?.id === loc.id ? { ...prev, altitude } : prev);
          queryClient.setQueriesData<PoiLocation[]>({ queryKey: ['pois'] }, (old = []) =>
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
        queryClient.setQueriesData<PoiLocation[]>({ queryKey: ['pois'] }, (old = []) =>
          old.map(p => p.id === loc.id ? { ...p, ...enriched } : p)
        );
        api.enrichPoi(loc.id, enriched).catch(() => {});
      }).catch(() => {});
    }
  }, [queryClient]);

  const setSpotDisabled = useCallback(async (poiId: string, disabledUntil: string | null): Promise<boolean> => {
    const success = await api.updatePoi(poiId, { disabledUntil });
    if (success) {
      queryClient.setQueriesData<PoiLocation[]>({ queryKey: ['pois'] }, (old = []) =>
        old.map(p => p.id === poiId ? { ...p, disabledUntil } : p)
      );
      setSelectedLocation(prev => prev?.id === poiId ? { ...prev, disabledUntil } : prev);
    }
    return success;
  }, [queryClient]);

  const deleteSpot = useCallback(async (poiId: string): Promise<boolean> => {
    try {
      await api.deletePoi(poiId);
      queryClient.setQueriesData<PoiLocation[]>({ queryKey: ['pois'] }, (old = []) => old.filter(p => p.id !== poiId));
      setSelectedLocation(prev => prev?.id === poiId ? null : prev);
      return true;
    } catch {
      return false;
    }
  }, [queryClient]);

  const updateSpot = useCallback(async (poiId: string, updates: Partial<PoiLocation>): Promise<boolean> => {
    const success = await api.updatePoi(poiId, updates);
    if (success) {
      queryClient.setQueriesData<PoiLocation[]>({ queryKey: ['pois'] }, (old = []) =>
        old.map(p => p.id === poiId ? { ...p, ...updates } : p)
      );
      setSelectedLocation(prev => prev?.id === poiId ? { ...prev, ...updates } : prev);
    }
    return success;
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
    setSpotDisabled,
    deleteSpot,
    updateSpot,
    refetchPois: query.refetch,
  };
}
