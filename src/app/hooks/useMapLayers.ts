import { useState, useEffect, useRef, useCallback } from 'react';
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

  // Refs = toujours la valeur courante, sans problème de closure stale
  const mapBoundsRef = useRef<MapBounds | null>(null);
  const showProtectedAreasRef = useRef(false);
  const showWaterPointsRef = useRef(false);

  // Synchroniser les refs avec les states
  useEffect(() => { showProtectedAreasRef.current = showProtectedAreas; }, [showProtectedAreas]);
  useEffect(() => { showWaterPointsRef.current = showWaterPoints; }, [showWaterPoints]);

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

  // Appelé par App.tsx sur chaque moveend — utilise des refs pour éviter les closures stales
  const setMapBounds = useCallback((bounds: MapBounds) => {
    mapBoundsRef.current = bounds;
    // Réafficher les boutons si les toggles sont actifs
    if (showProtectedAreasRef.current) setShowProtectedAreasButton(true);
    if (showWaterPointsRef.current) setShowWaterPointsButton(true);
  }, []);

  // Charge les zones protégées pour le viewport courant (toujours les bounds frais via ref)
  const loadProtectedAreasForView = useCallback(async () => {
    const bounds = mapBoundsRef.current;
    if (!bounds) return;
    setShowProtectedAreasButton(false);
    setIsLoadingProtectedAreas(true);
    try {
      devLog.log('🗻 Chargement zones protégées (viewport)...');
      const areas = await fetchProtectedAreas(bounds);
      const hiddenIds = new Set(hiddenOsmQuery.data ?? []);
      const filtered = areas.filter((a: ProtectedArea) => !hiddenIds.has(a.id));
      devLog.log(`✅ ${filtered.length} zones protégées`);
      queryClient.setQueryData(['protectedAreas'], filtered);
    } catch (err) {
      devLog.warn('⚠️ Erreur zones protégées:', err);
    } finally {
      setIsLoadingProtectedAreas(false);
    }
  }, [hiddenOsmQuery.data, queryClient]);

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
      setShowProtectedAreasButton(next); // Affiche le bouton à l'activation, le cache à la désactivation
      return next;
    });
  };

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
