/**
 * Service Overpass API
 *
 * Interroge OpenStreetMap via l'API Overpass pour récupérer des données géographiques.
 * Utilisé pour extraire les points d'eau (sources, fontaines, puits, etc.)
 */

import { devLog } from '../utils/logger';

export interface WaterPoint {
  id: string;
  type: 'node' | 'way';
  lat: number;
  lng: number;
  tags: {
    name?: string;
    amenity?: string;
    natural?: string;
    man_made?: string;
    drinking_water?: string;
    seasonal?: string;
    access?: string;
    description?: string;
  };
  waterType: 'drinking_water' | 'spring' | 'water_well' | 'water_point' | 'stream' | 'waterfall';
}

// Cache des résultats pour éviter les requêtes répétées
interface CacheEntry {
  data: WaterPoint[];
  timestamp: number;
  bounds: string;
}

const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes (augmenté pour réduire les appels)

// Rate limiting avancé
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 8000; // 8 secondes minimum entre les requêtes (augmenté)
let pendingRequest: Promise<WaterPoint[]> | null = null;
let failedRequestsCount = 0;
let lastFailureTime = 0;
const MAX_RETRIES = 3; // Augmenté à 3 tentatives
const BACKOFF_BASE = 10000; // 10 secondes de base pour le backoff (doublé)

// Erreur rate limit
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Génère une clé de cache basée sur les bounds
 */
function getCacheKey(bounds: { south: number; west: number; north: number; east: number }): string {
  // Arrondir à 3 décimales pour avoir des zones de ~100m
  const roundedBounds = {
    south: Math.floor(bounds.south * 1000) / 1000,
    west: Math.floor(bounds.west * 1000) / 1000,
    north: Math.ceil(bounds.north * 1000) / 1000,
    east: Math.ceil(bounds.east * 1000) / 1000,
  };
  return `${roundedBounds.south},${roundedBounds.west},${roundedBounds.north},${roundedBounds.east}`;
}

// Limites de zone pour éviter les timeouts
const MAX_AREA_SIZE = 0.5; // 0.5 degrés max (~55km) - limite pour éviter les 504
const MAX_AREA_SQUARE = 0.15; // 0.15 degrés² max pour la surface

/**
 * Vérifie si la zone de recherche est trop grande
 */
function isAreaTooLarge(bounds: { south: number; west: number; north: number; east: number }): boolean {
  const latDiff = Math.abs(bounds.north - bounds.south);
  const lngDiff = Math.abs(bounds.east - bounds.west);
  const area = latDiff * lngDiff;
  
  return latDiff > MAX_AREA_SIZE || lngDiff > MAX_AREA_SIZE || area > MAX_AREA_SQUARE;
}

/**
 * Récupère les points d'eau dans une zone géographique
 * 
 * @param bounds - Limites géographiques (sud, ouest, nord, est)
 * @param timeout - Timeout en secondes (défaut: 60s augmenté pour éviter 504)
 */
export async function fetchWaterPoints(
  bounds: { south: number; west: number; north: number; east: number },
  timeout: number = 60
): Promise<WaterPoint[]> {
  // Vérifier la taille de la zone
  if (isAreaTooLarge(bounds)) {
    const latDiff = Math.abs(bounds.north - bounds.south);
    const lngDiff = Math.abs(bounds.east - bounds.west);
    devLog.warn(`⚠️ Zone trop grande: ${latDiff.toFixed(3)}° x ${lngDiff.toFixed(3)}° (max: ${MAX_AREA_SIZE}°)`);
    throw new Error('Zone trop grande. Zoomez davantage sur la carte pour charger les points d\'eau.');
  }
  // Vérifier le cache
  const cacheKey = getCacheKey(bounds);
  const cached = cache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    devLog.log('Points d\'eau récupérés depuis le cache');
    return cached.data;
  }

  // Si une requête est déjà en cours, la retourner
  if (pendingRequest) {
    devLog.log('Requête déjà en cours, réutilisation...');
    return pendingRequest;
  }

  // Rate limiting - vérifier si on peut faire une requête
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  // Si trop de requêtes ont échoué récemment, imposer un backoff plus long
  if (failedRequestsCount > 0) {
    const timeSinceLastFailure = now - lastFailureTime;
    const backoffDuration = BACKOFF_BASE * Math.pow(2, failedRequestsCount - 1); // Backoff exponentiel
    
    if (timeSinceLastFailure < backoffDuration) {
      const waitTime = backoffDuration - timeSinceLastFailure;
      devLog.log(`⏸️ Backoff actif: attente de ${Math.ceil(waitTime / 1000)}s avant la prochaine tentative (échecs: ${failedRequestsCount})`);
      throw new RateLimitError(`Veuillez patienter ${Math.ceil(waitTime / 1000)} secondes avant de réessayer.`);
    } else {
      // Réinitialiser le compteur si suffisamment de temps s'est écoulé
      devLog.log('✅ Période de backoff terminée, réinitialisation des échecs');
      failedRequestsCount = 0;
    }
  }
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    // Attendre avant de faire la requête
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    devLog.log(`⏱️ Rate limiting: attente de ${Math.ceil(waitTime / 1000)}s avant la prochaine requête`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  // Marquer le début de la requête
  lastRequestTime = Date.now();

  // Créer la promesse de requête avec retry
  pendingRequest = executeOverpassQueryWithRetry(bounds, timeout, cacheKey);
  
  try {
    const result = await pendingRequest;
    // Réinitialiser le compteur d'échecs en cas de succès
    failedRequestsCount = 0;
    return result;
  } catch (error) {
    // Incrémenter le compteur d'échecs
    if (error instanceof RateLimitError) {
      failedRequestsCount++;
      lastFailureTime = Date.now();
      devLog.warn(`❌ Échec ${failedRequestsCount} de la requête (rate limit)`);
    }
    throw error;
  } finally {
    pendingRequest = null;
  }
}

/**
 * Exécute la requête Overpass avec retry automatique
 */
async function executeOverpassQueryWithRetry(
  bounds: { south: number; west: number; north: number; east: number },
  timeout: number,
  cacheKey: string,
  retryCount: number = 0
): Promise<WaterPoint[]> {
  try {
    return await executeOverpassQuery(bounds, timeout, cacheKey);
  } catch (error) {
    // Ne pas retry sur RateLimitError - laisser le backoff gérer
    if (error instanceof RateLimitError) {
      throw error;
    }
    
    // Retry pour les autres erreurs (max 3 fois)
    if (retryCount < MAX_RETRIES) {
      const waitTime = 3000 * (retryCount + 1); // 3s, 6s, 9s
      devLog.log(`🔄 Tentative ${retryCount + 1}/${MAX_RETRIES} après ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return executeOverpassQueryWithRetry(bounds, timeout, cacheKey, retryCount + 1);
    }
    
    // Si toutes les tentatives échouent, incrémenter le compteur d'échecs
    if (error?.message?.includes('504') || error?.message?.includes('429') || 
        error?.message?.includes('503') || error?.message?.includes('surchargée')) {
      failedRequestsCount++;
      lastFailureTime = Date.now();
      devLog.warn(`❌ Toutes les tentatives échouées (${retryCount + 1}/${MAX_RETRIES}). Échecs totaux: ${failedRequestsCount}`);
    }
    
    throw error;
  }
}

/**
 * Exécute la requête Overpass
 */
async function executeOverpassQuery(
  bounds: { south: number; west: number; north: number; east: number },
  timeout: number,
  cacheKey: string
): Promise<WaterPoint[]> {
  const { south, west, north, east } = bounds;
  
  // Requête OverpassQL optimisée - simplifiée pour réduire le timeout
  // On se concentre sur les points d'eau essentiels
  const query = `
    [out:json][timeout:${timeout}][maxsize:536870912];
    (
      node["amenity"="drinking_water"](${south},${west},${north},${east});
      node["amenity"="water_point"](${south},${west},${north},${east});
      node["natural"="spring"](${south},${west},${north},${east});
      node["man_made"="water_well"](${south},${west},${north},${east});
    );
    out body qt;
  `;

  try {
    // Essayer d'abord le proxy Edge Function (pas de CORS)
    const EDGE_URL = (import.meta as any).env?.VITE_EDGE_FUNCTION_URL;
    const ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
    let data: any = null;

    if (EDGE_URL && ANON_KEY) {
      try {
        const proxyResp = await fetch(`${EDGE_URL}/water-points`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}` },
          body: JSON.stringify({ south: bounds.south, west: bounds.west, north: bounds.north, east: bounds.east, timeout }),
          signal: AbortSignal.timeout(45000),
        });
        if (proxyResp.ok) {
          const json = await proxyResp.json();
          if (json.success && json.data) {
            data = json.data;
            devLog.log('✅ Points d\'eau via proxy Edge Function');
          }
        }
      } catch (proxyErr: any) {
        devLog.warn(`⚠️ Proxy Edge Function indisponible: ${proxyErr?.message}`);
      }
    }

    // Fallback direct si le proxy a échoué
    if (!data) {
      const controller = new AbortController();
      const clientTimeout = setTimeout(() => controller.abort(), (timeout + 20) * 1000);

      const OVERPASS_ENDPOINTS = [
        'https://overpass.kumi.systems/api/interpreter',
        'https://overpass-api.de/api/interpreter',
        'https://overpass.openstreetmap.ru/api/interpreter',
      ];

      let response: Response | null = null;
      let lastError: Error | null = null;
      for (const endpoint of OVERPASS_ENDPOINTS) {
        const perEndpointController = new AbortController();
        const perEndpointTimeout = setTimeout(() => perEndpointController.abort(), 20000);
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            body: `data=${encodeURIComponent(query)}`,
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            signal: perEndpointController.signal,
          });
          clearTimeout(perEndpointTimeout);
          if (response.ok || response.status === 429 || response.status === 504 || response.status === 503) break;
          lastError = new Error(`HTTP ${response.status}`);
        } catch (err: any) {
          clearTimeout(perEndpointTimeout);
          if (err.name === 'AbortError' && controller.signal.aborted) throw err;
          lastError = err;
        }
      }
      clearTimeout(clientTimeout);
      if (!response) throw lastError ?? new Error('Overpass API inaccessible');

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitSeconds = retryAfter ? parseInt(retryAfter) : 60;
        throw new RateLimitError(`Trop de requêtes. Veuillez patienter ${waitSeconds} secondes avant de réessayer.`);
      }
      if (response.status === 504) throw new Error('Timeout serveur (504)');
      if (response.status === 503) throw new Error('Service indisponible (503)');
      if (!response.ok) throw new Error(`Erreur Overpass API: ${response.status} ${response.statusText}`);

      data = await response.json();
    }

    const waterPoints = parseWaterPoints(data);
    
    // Mettre en cache
    cache.set(cacheKey, {
      data: waterPoints,
      timestamp: Date.now(),
      bounds: cacheKey,
    });
    
    // Nettoyer le cache (garder max 10 entrées)
    if (cache.size > 10) {
      const oldestKey = Array.from(cache.keys())[0];
      cache.delete(oldestKey);
    }
    
    devLog.log(`${waterPoints.length} points d'eau récupérés depuis Overpass API`);
    
    return waterPoints;
  } catch (error: any) {
    // Log simplifié pour ne pas encombrer la console
    const errorType = error instanceof RateLimitError ? 'Rate limit' : 
                     error?.name === 'AbortError' ? 'Timeout' :
                     error?.message?.includes('504') ? 'Timeout 504' :
                     error?.message?.includes('503') ? 'Service indisponible' :
                     error?.message?.includes('429') ? 'Trop de requêtes' :
                     error?.message?.includes('trop grande') ? 'Zone trop grande' :
                     'Erreur API';
    devLog.warn(`⚠️ Overpass API: ${errorType}`);
    
    // Toujours essayer d'utiliser le cache en cas d'erreur serveur
    const cached = cache.get(cacheKey);
    
    // Si c'est une erreur de rate limit, timeout, ou erreur serveur
    if (error instanceof RateLimitError || 
        error?.name === 'AbortError' ||
        error?.message?.includes('504') || 
        error?.message?.includes('503') ||
        error?.message?.includes('surchargée') ||
        error?.message?.includes('trop grande')) {
      
      if (cached) {
        devLog.log('💾 Utilisation du cache en raison d\'une erreur serveur/timeout');
        return cached.data;
      }
    }
    
    throw error;
  }
}

/**
 * Vide le cache des points d'eau
 */
export function clearWaterPointsCache(): void {
  cache.clear();
  devLog.log('Cache des points d\'eau vidé');
}

/**
 * Réinitialise complètement le système de rate limiting
 * Utile en cas de blocage persistant
 */
export function resetRateLimiting(): void {
  failedRequestsCount = 0;
  lastFailureTime = 0;
  lastRequestTime = 0;
  pendingRequest = null;
  devLog.log('✅ Rate limiting réinitialisé');
}

/**
 * Obtient l'état actuel du rate limiting
 */
export function getRateLimitStatus(): {
  failedRequests: number;
  backoffActive: boolean;
  remainingBackoffSeconds: number;
} {
  const now = Date.now();
  const timeSinceLastFailure = now - lastFailureTime;
  const backoffDuration = failedRequestsCount > 0 ? BACKOFF_BASE * Math.pow(2, failedRequestsCount - 1) : 0;
  const remainingBackoff = Math.max(0, backoffDuration - timeSinceLastFailure);
  
  return {
    failedRequests: failedRequestsCount,
    backoffActive: remainingBackoff > 0,
    remainingBackoffSeconds: Math.ceil(remainingBackoff / 1000),
  };
}

/**
 * Calcule la distance entre deux points en kilomètres (formule de Haversine)
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Trouve la distance minimale entre un point d'eau et tous les spots de bivouac
 */
function getMinDistanceToSpots(
  waterPoint: WaterPoint,
  spots: Array<{ lat: number; lng: number }>
): number {
  if (spots.length === 0) return Infinity;
  
  let minDistance = Infinity;
  for (const spot of spots) {
    const distance = calculateDistance(
      waterPoint.lat,
      waterPoint.lng,
      spot.lat,
      spot.lng
    );
    if (distance < minDistance) {
      minDistance = distance;
    }
  }
  return minDistance;
}

/**
 * Filtre et trie les points d'eau pour n'en garder qu'un nombre limité,
 * en privilégiant ceux proches des spots de bivouac
 * 
 * @param waterPoints - Tous les points d'eau récupérés
 * @param spots - Positions des spots de bivouac
 * @param maxPoints - Nombre maximum de points à retourner (undefined = tous les points)
 */
export function filterAndSortWaterPoints(
  waterPoints: WaterPoint[],
  spots: Array<{ lat: number; lng: number }>,
  maxPoints?: number
): WaterPoint[] {
  // Si pas de limite, retourner tous les points
  if (maxPoints === undefined) {
    devLog.log(`Affichage de tous les ${waterPoints.length} points d'eau (pas de limite)`);
    return waterPoints;
  }

  if (waterPoints.length <= maxPoints) {
    return waterPoints;
  }

  // Si aucun spot, prendre les N premiers
  if (spots.length === 0) {
    devLog.log(`Limitation à ${maxPoints} points d'eau (aucun spot de référence)`);
    return waterPoints.slice(0, maxPoints);
  }

  // Calculer la distance de chaque point d'eau au spot le plus proche
  const waterPointsWithDistance = waterPoints.map(wp => ({
    waterPoint: wp,
    distanceToNearestSpot: getMinDistanceToSpots(wp, spots)
  }));

  // Trier par distance croissante (les plus proches en premier)
  waterPointsWithDistance.sort((a, b) => a.distanceToNearestSpot - b.distanceToNearestSpot);

  // Prendre les N plus proches
  const filtered = waterPointsWithDistance.slice(0, maxPoints).map(item => item.waterPoint);
  
  devLog.log(`Affichage de ${filtered.length} points d'eau sur ${waterPoints.length} (les plus proches des ${spots.length} spots)`);
  
  return filtered;
}

/**
 * Parse les données Overpass pour extraire les points d'eau
 */
function parseWaterPoints(data: any): WaterPoint[] {
  const waterPoints: WaterPoint[] = [];

  if (!data.elements || !Array.isArray(data.elements)) {
    return waterPoints;
  }

  for (const element of data.elements) {
    if (element.type !== 'node' || !element.lat || !element.lon) {
      continue;
    }

    const tags = element.tags || {};
    
    // Déterminer le type de point d'eau
    let waterType: WaterPoint['waterType'] = 'water_point';
    
    if (tags.amenity === 'drinking_water') {
      waterType = 'drinking_water';
    } else if (tags.natural === 'spring') {
      waterType = 'spring';
    } else if (tags.man_made === 'water_well') {
      waterType = 'water_well';
    } else if (tags.amenity === 'water_point') {
      waterType = 'water_point';
    } else if (tags.waterway === 'waterfall') {
      waterType = 'waterfall';
    }

    waterPoints.push({
      id: `osm-${element.type}-${element.id}`,
      type: element.type,
      lat: element.lat,
      lng: element.lon,
      tags,
      waterType,
    });
  }

  return waterPoints;
}

/**
 * Détermine si un point d'eau est potable
 */
export function isDrinkable(waterPoint: WaterPoint): boolean {
  const { tags, waterType } = waterPoint;
  
  // Si explicitement marqué comme non potable
  if (tags.drinking_water === 'no') {
    return false;
  }
  
  // Types généralement potables
  if (waterType === 'drinking_water' || waterType === 'water_point') {
    return true;
  }
  
  // Source : potable sauf indication contraire
  if (waterType === 'spring' && tags.drinking_water !== 'no') {
    return true;
  }
  
  // Puits : vérifier le tag drinking_water
  if (waterType === 'water_well' && tags.drinking_water === 'yes') {
    return true;
  }
  
  // Cascade : généralement non potable
  if (waterType === 'waterfall') {
    return false;
  }
  
  return false;
}

/**
 * Obtient une description lisible du type de point d'eau
 */
export function getWaterPointLabel(waterPoint: WaterPoint): string {
  const { tags, waterType } = waterPoint;
  
  // Si un nom existe, l'utiliser
  if (tags.name) {
    return tags.name;
  }
  
  // Sinon, retourner un label selon le type
  const labels: Record<WaterPoint['waterType'], string> = {
    drinking_water: 'Fontaine potable',
    spring: 'Source',
    water_well: 'Puits',
    water_point: 'Point d\'eau',
    stream: 'Ruisseau',
    waterfall: 'Cascade',
  };
  
  return labels[waterType] || 'Point d\'eau';
}

/**
 * Obtient des informations supplémentaires sur le point d'eau
 */
export function getWaterPointInfo(waterPoint: WaterPoint): string[] {
  const { tags } = waterPoint;
  const info: string[] = [];
  
  // Potabilité
  if (isDrinkable(waterPoint)) {
    info.push('✓ Eau potable');
  } else if (tags.drinking_water === 'no') {
    info.push('✗ Eau non potable');
  }
  
  // Saisonnalité
  if (tags.seasonal === 'yes') {
    info.push('Saisonnier (peut être à sec)');
  }
  
  // Accès
  if (tags.access === 'private') {
    info.push('Accès privé');
  } else if (tags.access === 'permissive') {
    info.push('Accès sur autorisation');
  }
  
  // Description
  if (tags.description) {
    info.push(tags.description);
  }
  
  return info;
}
