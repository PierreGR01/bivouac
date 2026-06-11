import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAlpesProtectedAreas, ProtectedArea } from '../services/protected-areas';
import { fetchCustomZones, CustomZone } from '../../utils/supabase/custom-zones-api';
import { devLog } from '../utils/logger';

export function useMapLayers() {
  const [satelliteMode, setSatelliteMode] = useState(false);
  const [winterMode, setWinterMode] = useState(false);

  const [showWaterPoints, setShowWaterPoints] = useState(false);
  const [showWaterPointsInfo, setShowWaterPointsInfo] = useState(false);
  const [showWaterPointsButton, setShowWaterPointsButton] = useState(false);
  const [isLoadingWaterPoints, setIsLoadingWaterPoints] = useState(false);
  const [waterPoints, setWaterPoints] = useState<any[]>([]);

  const [showProtectedAreas, setShowProtectedAreas] = useState(false);

  const customZonesQuery = useQuery({
    queryKey: ['customZones'],
    queryFn: async () => {
      const zones = await fetchCustomZones();
      return zones;
    },
    staleTime: 10 * 60 * 1000,
  });

  const protectedAreasQuery = useQuery({
    queryKey: ['protectedAreas'],
    queryFn: async () => {
      devLog.log('🗻 Chargement des zones protégées (région Alpes)...');
      const areas = await fetchAlpesProtectedAreas();
      if (areas.length === 0) {
        devLog.log('⚠️ Aucune zone protégée trouvée');
      } else {
        devLog.log(`✅ ${areas.length} zones protégées chargées (Alpes)`);
      }
      return areas;
    },
    enabled: false,
    staleTime: 30 * 60 * 1000,
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
    const next = !showProtectedAreas;
    if (next && (protectedAreasQuery.data ?? []).length === 0) {
      protectedAreasQuery.refetch();
    }
    setShowProtectedAreas(next);
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
    allProtectedAreas: protectedAreasQuery.data ?? [],
    isLoadingProtectedAreas: protectedAreasQuery.isFetching,
    customZones: customZonesQuery.data ?? [],
    loadProtectedAreas: protectedAreasQuery.refetch,
    toggleProtectedAreas,
  };
}
