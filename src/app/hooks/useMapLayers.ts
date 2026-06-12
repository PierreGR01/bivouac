import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchProtectedAreas, ProtectedArea } from '../services/protected-areas';
import { fetchCustomZones, CustomZone } from '../../utils/supabase/custom-zones-api';
import { fetchHiddenOsmZoneIds } from '../../utils/supabase/hidden-osm-zones-api';
import { devLog } from '../utils/logger';

type MapBounds = { south: number; west: number; north: number; east: number };

// Arrondit les bounds à 1 décimale (~10km) pour éviter trop de requêtes
function roundBoundsKey(b: MapBounds): string {
  const r = (v: number) => Math.round(v * 10) / 10;
  return `${r(b.south)},${r(b.west)},${r(b.north)},${r(b.east)}`;
}

export function useMapLayers() {
  const [satelliteMode, setSatelliteMode] = useState(false);
  const [winterMode, setWinterMode] = useState(false);

  const [showWaterPoints, setShowWaterPoints] = useState(false);
  const [showWaterPointsInfo, setShowWaterPointsInfo] = useState(false);
  const [showWaterPointsButton, setShowWaterPointsButton] = useState(false);
  const [isLoadingWaterPoints, setIsLoadingWaterPoints] = useState(false);
  const [waterPoints, setWaterPoints] = useState<any[]>([]);

  const [showProtectedAreas, setShowProtectedAreas] = useState(false);
  const [mapBounds, setMapBounds] = useState<MapBounds | null>(null);

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

  const boundsKey = mapBounds ? roundBoundsKey(mapBounds) : null;

  const protectedAreasQuery = useQuery({
    queryKey: ['protectedAreas', boundsKey],
    queryFn: async () => {
      if (!mapBounds) return [];
      devLog.log('🗻 Chargement zones protégées (viewport)...');
      const areas = await fetchProtectedAreas(mapBounds);
      const hiddenIds = new Set(hiddenOsmQuery.data ?? []);
      const filtered = areas.filter(a => !hiddenIds.has(a.id));
      devLog.log(`✅ ${filtered.length} zones protégées (${areas.length - filtered.length} masquées)`);
      return filtered;
    },
    enabled: showProtectedAreas && !!mapBounds,
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
    setShowProtectedAreas(prev => !prev);
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
    allProtectedAreas: protectedAreasQuery.data ?? [],
    isLoadingProtectedAreas: protectedAreasQuery.isFetching,
    customZones: customZonesQuery.data ?? [],
    loadProtectedAreas: protectedAreasQuery.refetch,
    toggleProtectedAreas,
  };
}
