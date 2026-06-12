import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchProtectedAreas, ProtectedArea } from '../services/protected-areas';
import { fetchCustomZones } from '../../utils/supabase/custom-zones-api';
import { fetchHiddenOsmZoneIds } from '../../utils/supabase/hidden-osm-zones-api';
import { devLog } from '../utils/logger';

type MapBounds = { south: number; west: number; north: number; east: number };

export function useMapLayers() {
  const queryClient = useQueryClient();

  const [satelliteMode, setSatelliteMode] = useState(false);
  const [winterMode, setWinterMode] = useState(false);

  const [showWaterPoints, setShowWaterPoints] = useState(false);
  const [showWaterPointsInfo, setShowWaterPointsInfo] = useState(false);
  const [showWaterPointsButton, setShowWaterPointsButton] = useState(false);
  const [isLoadingWaterPoints, setIsLoadingWaterPoints] = useState(false);
  const [waterPoints, setWaterPoints] = useState<any[]>([]);

  const [showProtectedAreas, setShowProtectedAreas] = useState(false);
  const [showProtectedAreasButton, setShowProtectedAreasButton] = useState(false);
  const [isLoadingProtectedAreas, setIsLoadingProtectedAreas] = useState(false);
  const [mapBounds, setMapBoundsState] = useState<MapBounds | null>(null);

  const customZonesQuery = useQuery({
    queryKey: ['customZones'],
    queryFn: fetchCustomZones,
    staleTime: 10 * 60 * 1000,
  });

  const hiddenOsmQuery = useQuery({
    queryKey: ['hiddenOsmZones'],
    queryFn: fetchHiddenOsmZoneIds,
    staleTime: 5 * 60 * 1000,
  });

  const protectedAreasQuery = useQuery({
    queryKey: ['protectedAreas'],
    queryFn: () => [] as ProtectedArea[],
    enabled: false,
    staleTime: Infinity,
  });

  const toggleSatellite = () => {
    setSatelliteMode(prev => {
      if (!prev) setWinterMode(false);
      return !prev;
    });
  };

  const toggleWinter = () => {
    setWinterMode(prev => {
      if (!prev) setSatelliteMode(false);
      return !prev;
    });
  };

  const toggleWaterPoints = () => {
    setShowWaterPoints(prev => {
      if (prev) setShowWaterPointsButton(false);
      return !prev;
    });
  };

  const toggleProtectedAreas = () => {
    setShowProtectedAreas(prev => {
      const next = !prev;
      if (next) setShowProtectedAreasButton(true);
      else setShowProtectedAreasButton(false);
      return next;
    });
  };

  // Appelé par App.tsx sur chaque mouvement de carte
  const setMapBounds = useCallback((bounds: MapBounds) => {
    setMapBoundsState(bounds);
    // Si les zones protégées sont actives → proposer de recharger
    setShowProtectedAreas(current => {
      if (current) setShowProtectedAreasButton(true);
      return current;
    });
  }, []);

  // Charge les zones protégées pour le viewport courant
  const loadProtectedAreasForView = useCallback(async () => {
    if (!mapBounds) return;
    setShowProtectedAreasButton(false);
    setIsLoadingProtectedAreas(true);
    try {
      devLog.log('🗻 Chargement zones protégées (viewport)...');
      const areas = await fetchProtectedAreas(mapBounds);
      const hiddenIds = new Set(hiddenOsmQuery.data ?? []);
      const filtered = areas.filter(a => !hiddenIds.has(a.id));
      devLog.log(`✅ ${filtered.length} zones protégées`);
      queryClient.setQueryData(['protectedAreas'], filtered);
    } catch (err) {
      devLog.warn('⚠️ Erreur chargement zones protégées:', err);
    } finally {
      setIsLoadingProtectedAreas(false);
    }
  }, [mapBounds, hiddenOsmQuery.data, queryClient]);

  return {
    satelliteMode,
    winterMode,
    toggleSatellite,
    toggleWinter,
    showWaterPoints,
    toggleWaterPoints,
    showWaterPointsInfo,
    setShowWaterPointsInfo,
    showWaterPointsButton,
    setShowWaterPointsButton,
    isLoadingWaterPoints,
    setIsLoadingWaterPoints,
    waterPoints,
    setWaterPoints,
    showProtectedAreas,
    setShowProtectedAreas,
    setMapBounds,
    showProtectedAreasButton,
    setShowProtectedAreasButton,
    isLoadingProtectedAreas,
    loadProtectedAreasForView,
    allProtectedAreas: protectedAreasQuery.data ?? [],
    customZones: customZonesQuery.data ?? [],
    loadProtectedAreas: loadProtectedAreasForView,
    toggleProtectedAreas,
  };
}
