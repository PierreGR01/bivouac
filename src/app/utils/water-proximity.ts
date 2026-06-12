import { WaterPoint, isNaturalWater } from '../services/overpass';
import { devLog } from './logger';
import { WATER_PROXIMITY_NEAR_M, WATER_PROXIMITY_FAR_M } from '../constants';

/**
 * Calcule la distance en mètres entre deux coordonnées géographiques
 * en utilisant la formule de Haversine
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Rayon de la Terre en mètres
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function proximityFromMinDistance(minDistance: number): 'proche' | 'éloigné' | null {
  if (minDistance < WATER_PROXIMITY_NEAR_M) return 'proche';
  if (minDistance < WATER_PROXIMITY_FAR_M) return 'éloigné';
  return null;
}

/**
 * Calcule la proximité aux points d'eau contrôlés (fontaines, sources, puits).
 * Exclut les cours d'eau et lacs naturels.
 */
export function calculateWaterProximity(
  spotLat: number,
  spotLng: number,
  waterPoints: WaterPoint[]
): 'proche' | 'éloigné' | null {
  const controlled = waterPoints.filter(wp => !isNaturalWater(wp));
  if (controlled.length === 0) {
    devLog.log('💧 Proximité eau contrôlée : aucun point disponible');
    return null;
  }

  let minDistance = Infinity;
  for (const wp of controlled) {
    const d = calculateDistance(spotLat, spotLng, wp.lat, wp.lng);
    if (d < minDistance) minDistance = d;
  }

  devLog.log(`💧 Eau contrôlée — distance min : ${minDistance.toFixed(2)}m`);
  return proximityFromMinDistance(minDistance);
}

/**
 * Calcule la proximité aux eaux naturelles non contrôlées (cours d'eau, lacs).
 * Seuil unique : 200m.
 */
export function calculateNaturalWaterProximity(
  spotLat: number,
  spotLng: number,
  waterPoints: WaterPoint[]
): 'proche' | null {
  const natural = waterPoints.filter(wp => isNaturalWater(wp));
  if (natural.length === 0) {
    devLog.log('🌊 Proximité eau naturelle : aucun point disponible');
    return null;
  }

  let minDistance = Infinity;
  for (const wp of natural) {
    const d = calculateDistance(spotLat, spotLng, wp.lat, wp.lng);
    if (d < minDistance) minDistance = d;
  }

  devLog.log(`🌊 Eau naturelle — distance min : ${minDistance.toFixed(2)}m`);
  return minDistance < WATER_PROXIMITY_FAR_M ? 'proche' : null;
}
