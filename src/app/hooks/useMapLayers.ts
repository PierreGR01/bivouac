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

  const [showRainRadar, setShowRainRadar] = useState(false);
  const [showLightning, setShowLightning] = useState(false);

  const [showProtectedAreas, setShowProtectedAreas] = useState(false);
  const [showProtectedAreasButton, setShowProtectedAreasButton] = useState(false);
  const [isLoadingProtectedAreas, setIsLoadingProtectedAreas] = useState(false);

  // mapBounds en state → changement déclenche le useEffect ci-dessous (fiable)
  // mapBoundsRef → lecture synchrone dans loadProtectedAreasForView (bounds frais)
  const [mapBounds, setMapBoundsState] = useState<MapBounds | null>(null);
  const mapBoundsRef = useRef<MapBounds | null>(null);

  // Quand la carte bouge : montrer les boutons si les toggles sont actifs
  // useEffect garantit l'exécution après le render avec les vraies valeurs de state
  useEffect(() => {
    if (!mapBounds) return;
    if (showProtectedAreas && !isLoadingProtectedAreas) setShowProtectedAreasButton(true);
    if (showWaterPoints) setShowWaterPointsButton(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapBounds]);

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

  // Appelé à chaque moveend (via listener permanent dans MapView)
  const setMapBounds = useCallback((bounds: MapBounds) => {
    mapBoundsRef.current = bounds;
    setMapBoundsState(bounds); // déclenche le useEffect ci-dessus
  }, []);

  // Charge les zones protégées pour le viewport courant
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
      setShowProtectedAreasButton(true); // afficher le bouton pour permettre un retry
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

  const toggleRainRadar = () => setShowRainRadar(prev => !prev);
  const toggleLightning = () => setShowLightning(prev => !prev);

  const toggleProtectedAreas = useCallback(() => {
    if (!showProtectedAreas) {
      // Activation : lancer le chargement immédiatement, sans afficher le bouton
      setShowProtectedAreas(true);
      setShowProtectedAreasButton(false);
      loadProtectedAreasForView();
    } else {
      // Désactivation
      setShowProtectedAreas(false);
      setShowProtectedAreasButton(false);
    }
  }, [showProtectedAreas, loadProtectedAreasForView]);

  return {
    satelliteMode,
    winterMode,
    toggleSatellite,
    toggleWinter,
    showRainRadar,
    toggleRainRadar,
    showLightning,
    toggleLightning,
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
