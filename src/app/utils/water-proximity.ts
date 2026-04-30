import { WaterPoint } from '../services/overpass';
import { devLog } from './logger';

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

/**
 * Calcule la proximité de l'eau en fonction des points d'eau disponibles
 * @param spotLat Latitude du spot
 * @param spotLng Longitude du spot
 * @param waterPoints Points d'eau disponibles
 * @returns 'proche' si <100m, 'éloigné' si 100-200m, null si >200m ou pas de points d'eau
 */
export function calculateWaterProximity(
  spotLat: number,
  spotLng: number,
  waterPoints: WaterPoint[]
): 'proche' | 'éloigné' | null {
  if (!waterPoints || waterPoints.length === 0) {
    devLog.log('💧 Calcul de proximité : aucun point d\'eau disponible');
    return null;
  }

  devLog.log(`💧 Calcul de proximité pour le spot (${spotLat.toFixed(5)}, ${spotLng.toFixed(5)}) avec ${waterPoints.length} points d'eau`);

  // Trouver le point d'eau le plus proche
  let minDistance = Infinity;
  
  for (const waterPoint of waterPoints) {
    const distance = calculateDistance(
      spotLat,
      spotLng,
      waterPoint.lat,
      waterPoint.lng
    );
    
    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  devLog.log(`💧 Distance minimale trouvée : ${minDistance.toFixed(2)}m`);

  // Déterminer la proximité selon les seuils
  if (minDistance < 100) {
    devLog.log('💧 Résultat : proche (<100m)');
    return 'proche';
  } else if (minDistance < 200) {
    devLog.log('💧 Résultat : éloigné (100-200m)');
    return 'éloigné';
  } else {
    devLog.log('💧 Résultat : trop loin (>200m)');
    return null;
  }
}
