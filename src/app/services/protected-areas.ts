/**
 * Service Protected Areas API - Optimisé pour viewport
 *
 * Interroge OpenStreetMap via l'API Overpass pour récupérer les zones protégées
 * visibles dans la zone actuelle de la carte uniquement.
 */

import { devLog } from '../utils/logger';

export interface ProtectedArea {
  id: string;
  type: 'way' | 'relation';
  name?: string;
  geometry: Array<{ lat: number; lng: number }>;
  rings?: Array<Array<{ lat: number; lng: number }>>; // Multiple disjoint outer rings for multipolygon relations
  tags: {
    boundary?: string;
    leisure?: string;
    protect_class?: string;
    protection_title?: string;
    name?: string;
    'name:fr'?: string;
    operator?: string;
    designation?: string;
    description?: string;
    website?: string;
  };
  areaType: 'national_park' | 'regional_park' | 'nature_reserve' | 'protected_area' | 'wilderness' | 'natura2000' | 'military' | 'heritage' | 'prefectural_decree' | 'camping_restriction';
  protectionLevel: 'strict' | 'moderate' | 'low';
}

// Cache simple par viewport
interface CacheEntry {
  data: ProtectedArea[];
  timestamp: number;
  bounds: string;
}

const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes (viewport statiques en général)

// Rate limiting simple
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 3000; // 3 secondes entre requêtes
let pendingAlpesRequest: Promise<ProtectedArea[]> | null = null;

/**
 * Génère une clé de cache basée sur les bounds avec précision réduite
 * pour agréger les requêtes proches
 */
function getCacheKey(bounds: { south: number; west: number; north: number; east: number }): string {
  // Arrondir à 2 décimales (~1km de précision) pour agréger les viewports proches
  const round = (val: number) => Math.round(val * 100) / 100;
  return `${round(bounds.south)},${round(bounds.west)},${round(bounds.north)},${round(bounds.east)}`;
}

/**
 * Retourne les bounds pour la région Savoie/Isère/Haute-Alpes
 */
export function getAlpesRegionBounds(): { south: number; west: number; north: number; east: number } {
  // Région couvrant Savoie, Isère, Haute-Alpes (zone des Alpes françaises)
  return {
    south: 44.5,   // Latitude sud (sud de la Drôme/Hautes-Alpes)
    north: 46.3,   // Latitude nord (nord de la Savoie)
    west: 4.5,     // Longitude ouest
    east: 7.0      // Longitude est
  };
}

/**
 * Récupère les zones protégées pour la région fixe Savoie/Isère/Haute-Alpes
 * @param timeout Timeout en secondes
 */
export async function fetchAlpesProtectedAreas(
  timeout: number = 60
): Promise<ProtectedArea[]> {
  const bounds = getAlpesRegionBounds();
  const cacheKey = 'alpes-region-fixed';

  // Vérifier le cache (cache long pour région fixe)
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < (24 * 60 * 60 * 1000)) { // 24h pour région fixe
    devLog.log('🗺️ Zones Alpes récupérées du cache');
    return cached.data;
  }

  // Si une requête Alpes est déjà en cours, la réutiliser
  if (pendingAlpesRequest) {
    devLog.log('🔄 Requête zones Alpes en cours, réutilisation...');
    return pendingAlpesRequest;
  }

  // Rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    devLog.log(`⏱️ Rate limit: attente de ${Math.ceil(waitTime / 1000)}s`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();

  pendingAlpesRequest = executeProtectedAreasQuery(bounds, timeout, cacheKey);

  try {
    const result = await pendingAlpesRequest;
    return result;
  } finally {
    pendingAlpesRequest = null;
  }
}

/**
 * Récupère les zones protégées dans le viewport actuel uniquement
 * @param bounds Limites visibles de la carte
 * @param timeout Timeout en secondes (défaut: 30s pour viewport)
 */
export async function fetchProtectedAreas(
  bounds: { south: number; west: number; north: number; east: number },
  timeout: number = 30
): Promise<ProtectedArea[]> {
  // Vérifier le cache
  const cacheKey = getCacheKey(bounds);
  const cached = cache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    devLog.log('🗺️ Zones protégées récupérées du cache');
    return cached.data;
  }

  // Rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    devLog.log(`⏱️ Rate limit: attente de ${Math.ceil(waitTime / 1000)}s`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();

  return executeProtectedAreasQuery(bounds, timeout, cacheKey);
}

/**
 * Exécute la requête Overpass optimisée pour le viewport
 */
async function executeProtectedAreasQuery(
  bounds: { south: number; west: number; north: number; east: number },
  timeout: number,
  cacheKey: string
): Promise<ProtectedArea[]> {
  const { south, west, north, east } = bounds;

  // bbox par filtre (pas global) pour que out geom retourne la géométrie complète
  // sans clipping — sinon les ways des grandes relations (parcs nationaux) sont tronqués
  const bbox = `${south},${west},${north},${east}`;
  const query = `
    [out:json][timeout:${timeout}];
    (
      relation["boundary"="national_park"](${bbox});
      relation["boundary"="protected_area"](${bbox});
      relation["leisure"="nature_reserve"](${bbox});
      way["leisure"="nature_reserve"](${bbox});
      relation["designation"~"parc|réserve|arrêté|protected|park|reserve"](${bbox});
      way["designation"~"parc|réserve|arrêté|protected|park|reserve"](${bbox});
      relation["camping"~"no|forbidden|prohibited"](${bbox});
      way["camping"~"no|forbidden|prohibited"](${bbox});
      relation["bivouac"~"no|forbidden|prohibited"](${bbox});
      way["bivouac"~"no|forbidden|prohibited"](${bbox});
      relation["access"="no"](${bbox});
      way["access"="no"](${bbox});
    );
    out geom;
  `;

  try {
    const controller = new AbortController();
    const clientTimeout = setTimeout(() => controller.abort(), (timeout + 5) * 1000);

    devLog.log('🔍 Requête zones protégées...');

    const edgeFunctionUrl = import.meta.env.VITE_EDGE_FUNCTION_URL;
    let data: any = null;

    const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

    // Priorité : proxy Edge Function (évite CORS en production)
    if (edgeFunctionUrl && anonKey) {
      try {
        const proxyResp = await fetch(`${edgeFunctionUrl}/protected-areas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ south, west, north, east, timeout }),
          signal: controller.signal,
        });
        if (proxyResp.ok) {
          const result = await proxyResp.json();
          if (result.success) {
            data = result.data;
            devLog.log('✅ Zones protégées via proxy Edge Function');
          }
        }
      } catch (proxyErr) {
        devLog.warn('⚠️ Proxy zones protégées échoué, fallback direct', proxyErr);
      }
    }

    // Fallback : appel direct Overpass
    if (!data) {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: controller.signal,
      });

      clearTimeout(clientTimeout);

      if (!response.ok) {
        if (response.status === 504) throw new Error('Overpass timeout - zone trop complexe');
        if (response.status === 429) throw new Error('Overpass rate limit - trop de requêtes');
        throw new Error(`Overpass erreur ${response.status}`);
      }
      data = await response.json();
    }

    clearTimeout(clientTimeout);
    const areas = parseProtectedAreas(data);

    // Mettre en cache
    cache.set(cacheKey, {
      data: areas,
      timestamp: Date.now(),
      bounds: cacheKey,
    });

    devLog.log(`✅ ${areas.length} zones protégées trouvées`);
    return areas;
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    devLog.warn(`⚠️ Zones protégées: ${errorMsg}`);

    // Utiliser le cache expiré en cas d'erreur
    const cached = cache.get(cacheKey);
    if (cached) {
      devLog.log('💾 Utilisation du cache expiré');
      return cached.data;
    }

    return [];
  }
}

/**
 * Assemble des segments de ways OSM en anneaux fermés continus.
 * Overpass retourne les ways d'une relation dans un ordre arbitraire ;
 * cette fonction les chaîne bout-à-bout (en inversant si nécessaire)
 * pour former des polygones valides. Si certains segments ne se connectent
 * pas, ils forment des anneaux séparés (cas des enclaves/exclaves).
 */
function assembleRings(
  ways: Array<Array<{ lat: number; lng: number }>>
): Array<Array<{ lat: number; lng: number }>> {
  if (ways.length === 0) return [];
  if (ways.length === 1) return [ways[0]];

  const threshold = 0.00015; // ~15m de tolérance pour la connexion des extrémités
  const dist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
    Math.abs(a.lat - b.lat) + Math.abs(a.lng - b.lng);

  const rings: Array<Array<{ lat: number; lng: number }>> = [];
  const remaining = ways.map(w => [...w]);

  while (remaining.length > 0) {
    const ring = [...remaining.shift()!];

    let changed = true;
    while (changed && remaining.length > 0) {
      changed = false;
      for (let i = 0; i < remaining.length; i++) {
        const way = remaining[i];
        const ringEnd = ring[ring.length - 1];
        const ringStart = ring[0];
        const wayStart = way[0];
        const wayEnd = way[way.length - 1];

        if (dist(ringEnd, wayStart) < threshold) {
          ring.push(...way.slice(1));
          remaining.splice(i, 1);
          changed = true;
          break;
        } else if (dist(ringEnd, wayEnd) < threshold) {
          ring.push(...[...way].reverse().slice(1));
          remaining.splice(i, 1);
          changed = true;
          break;
        } else if (dist(ringStart, wayEnd) < threshold) {
          ring.unshift(...way.slice(0, -1));
          remaining.splice(i, 1);
          changed = true;
          break;
        } else if (dist(ringStart, wayStart) < threshold) {
          ring.unshift(...[...way].reverse().slice(0, -1));
          remaining.splice(i, 1);
          changed = true;
          break;
        }
      }
    }

    if (ring.length >= 3) {
      rings.push(ring);
    }
  }

  return rings;
}

/**
 * Parse les données Overpass pour extraire les zones protégées
 */
function parseProtectedAreas(data: any): ProtectedArea[] {
  const areas: ProtectedArea[] = [];

  if (!data.elements || !Array.isArray(data.elements)) {
    return areas;
  }

  for (const element of data.elements) {
    if (!element.members && !element.geometry) {
      continue;
    }

    const tags = element.tags || {};

    // Déterminer le type de zone
    let areaType: ProtectedArea['areaType'] = 'protected_area';
    let protectionLevel: ProtectedArea['protectionLevel'] = 'moderate';

    const protectionTitle = (tags.protection_title || '').toLowerCase();
    const designation = (tags.designation || '').toLowerCase();

    if (tags.boundary === 'national_park') {
      areaType = 'national_park';
      protectionLevel = 'strict';
    } else if (tags.leisure === 'nature_reserve') {
      areaType = 'nature_reserve';
      protectionLevel = 'strict';
    } else if (designation.includes('régional')) {
      areaType = 'regional_park';
      protectionLevel = 'moderate';
    } else if (designation.includes('natura')) {
      areaType = 'natura2000';
      protectionLevel = 'moderate';
    } else if (designation.includes('arrêté') || designation.includes('arrete')) {
      areaType = 'prefectural_decree';
      protectionLevel = designation.includes('camping') || designation.includes('bivouac') ? 'strict' : 'moderate';
    } else if (tags.boundary === 'protected_area') {
      areaType = 'protected_area';
      protectionLevel = 'moderate';
    }

    // Extraire la géométrie
    let geometry: Array<{ lat: number; lng: number }> = [];
    let rings: Array<Array<{ lat: number; lng: number }>> | undefined = undefined;

    if (element.type === 'way' && element.geometry) {
      const pts = element.geometry;
      const first = pts[0], last = pts[pts.length - 1];
      const isClosed = first && last &&
        Math.abs(first.lat - last.lat) < 0.0001 &&
        Math.abs(first.lon - last.lon) < 0.0001;
      if (!isClosed) continue; // way linéaire (route, chemin) → pas un polygone valide
      geometry = pts.map((point: any) => ({
        lat: point.lat,
        lng: point.lon,
      }));
    } else if (element.type === 'relation' && element.members) {
      const outerWays: Array<Array<{ lat: number; lng: number }>> = [];
      for (const member of element.members) {
        if (member.role === 'outer' && member.geometry) {
          outerWays.push(member.geometry.map((point: any) => ({
            lat: point.lat,
            lng: point.lon,
          })));
        }
      }
      const assembledRings = assembleRings(outerWays);
      if (assembledRings.length > 0) {
        geometry = assembledRings[0];
        if (assembledRings.length > 1) {
          rings = assembledRings;
        }
      }
    }

    // Ignorer si pas de géométrie valide
    if (geometry.length < 3) {
      continue;
    }

    areas.push({
      id: `osm-${element.type}-${element.id}`,
      type: element.type,
      name: tags.name || tags['name:fr'] || tags.protection_title,
      geometry,
      ...(rings ? { rings } : {}),
      tags,
      areaType,
      protectionLevel,
    });
  }

  return areas;
}

/**
 * Détermine si une zone doit être affichée sur la carte
 * Affiche les zones où le camping/bivouac est strictement interdit
 */
export function shouldDisplayOnMap(area: ProtectedArea): boolean {
  const tags = area.tags || {};
  const description = (tags.description || '').toLowerCase();
  const designation = (tags.designation || '').toLowerCase();
  const name = (tags.name || '').toLowerCase();
  const access = (tags.access || '').toLowerCase();

  // Combiner tous les textes pour recherche
  const allText = `${description} ${designation} ${name} ${access}`.toLowerCase();

  // EXCLUSIONS: zones clairement non pertinentes
  const excludeKeywords = [
    'parking', 'aire de pique-nique', 'picnic area', 'information', 'museum', 'office', 'visitor',
    'building', 'immeuble', 'maison', 'house', 'apartment', 'commercial'
  ];
  if (excludeKeywords.some(keyword => allText.includes(keyword))) {
    return false;
  }

  // Exclure les petits bâtiments/zones résidentielles (mais garder les vraies zones)
  if (tags.building && !tags.boundary && !tags.leisure && !tags.protection_title && !tags.designation) {
    return false;
  }

  // 1. Afficher les zones strictes (parcs nationaux, réserves naturelles)
  if (area.protectionLevel === 'strict') {
    return true;
  }

  // 2. Zones modérées: afficher si:
  //    - Arrêté préfectoral explicite sur camping/bivouac/nuit, OU
  //    - Tags explicites camping/bivouac=no, OU
  //    - Zone protégée (designation/protection_title avec mots pertinents) + access=no
  if (area.protectionLevel === 'moderate') {
    // Arrêté préfectoral explicite
    const hasCampingArrete = (designation.includes('arrêté') || designation.includes('arrete')) &&
                             (designation.includes('camping') || designation.includes('bivouac') || designation.includes('nuit'));

    // Tags explicites d'interdiction camping/bivouac
    const hasCampingForbidden = (tags.camping === 'no' || tags.camping === 'forbidden') ||
                                (tags.bivouac === 'no' || tags.bivouac === 'forbidden');

    // Zone protégée + access=no (parcs, réserves, etc.)
    const isProtectedZone = tags.boundary || tags.leisure === 'nature_reserve' || tags.protection_title || tags.designation;
    const hasAccessRestriction = tags.access === 'no' || tags.access === 'private';
    const isProtectedAndRestricted = isProtectedZone && hasAccessRestriction;

    if (hasCampingArrete || hasCampingForbidden || isProtectedAndRestricted) {
      return true;
    }
  }

  return false;
}

/**
 * Récupère le label/nom d'une zone protégée
 */
export function getProtectedAreaLabel(area: ProtectedArea): string {
  return area.name || area.tags.protection_title || 'Zone protégée';
}

/**
 * Récupère les informations de présentation d'une zone protégée
 */
export function getProtectedAreaInfo(area: ProtectedArea): {
  title: string;
  description?: string;
  restrictions: string[];
  isCampingForbidden: boolean;
  color: string;
} {
  const isCampingForbidden = area.protectionLevel === 'strict';
  const color = isCampingForbidden ? '#dc2626' : '#f97316';

  const restrictions: string[] = [];
  if (isCampingForbidden) {
    restrictions.push('Camping strictement interdit');
    restrictions.push('Bivouac interdit');
  } else if (area.protectionLevel === 'moderate') {
    restrictions.push('Camping réglementé');
    restrictions.push('Respecter les arrêtés préfectoraux');
  }

  return {
    title: area.name || area.tags.protection_title || 'Zone protégée',
    description: area.tags.description,
    restrictions,
    isCampingForbidden,
    color,
  };
}

/**
 * Récupère les zones contenant un point donné
 */
export function findAreasContainingPoint(
  point: { lat: number; lng: number },
  areas: ProtectedArea[]
): ProtectedArea[] {
  return areas.filter(area => isPointInPolygon(point, area.geometry));
}

/**
 * Utilise l'algorithme de rayon pour vérifier si un point est dans un polygone
 */
function isPointInPolygon(point: { lat: number; lng: number }, polygon: Array<{ lat: number; lng: number }>): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;

    const intersect = ((yi > point.lat) !== (yj > point.lat))
      && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Convertit une ProtectedArea en GeoJSON Feature (Polygon ou MultiPolygon).
 * Utilisé pour initialiser l'éditeur de zone custom depuis une zone OSM.
 */
export function protectedAreaToGeojson(area: ProtectedArea): GeoJSON.Feature {
  const rings = area.rings || [area.geometry];
  if (rings.length === 1) {
    return {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [rings[0].map(p => [p.lng, p.lat])],
      },
    };
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'MultiPolygon',
      coordinates: rings.map(ring => [ring.map(p => [p.lng, p.lat])]),
    },
  };
}

/**
 * Récupère une zone OSM spécifique par son ID (format "osm-relation-1024498").
 * Utilisé pour réinitialiser la géométrie d'une custom zone depuis OSM.
 */
export async function fetchOsmZoneById(osmId: string): Promise<ProtectedArea | null> {
  const parts = osmId.split('-');
  if (parts.length < 3) return null;
  const type = parts[1]; // 'relation' ou 'way'
  const id = parts.slice(2).join('-');

  const query = `[out:json][timeout:30];${type}(${id});out geom;`;

  try {
    const edgeFunctionUrl = import.meta.env.VITE_EDGE_FUNCTION_URL;
    const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
    let data: any = null;

    if (edgeFunctionUrl && anonKey) {
      try {
        const resp = await fetch(`${edgeFunctionUrl}/protected-areas-by-id`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
          body: JSON.stringify({ type, id }),
        });
        if (resp.ok) {
          const result = await resp.json();
          if (result.success) data = result.data;
        }
      } catch { /* fallback direct */ }
    }

    if (!data) {
      const resp = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (!resp.ok) throw new Error(`Overpass erreur ${resp.status}`);
      data = await resp.json();
    }

    const areas = parseProtectedAreas(data);
    return areas[0] ?? null;
  } catch (error) {
    devLog.warn('⚠️ fetchOsmZoneById:', error);
    return null;
  }
}

/**
 * Vide le cache (pour tests ou reset)
 */
export function clearCache(): void {
  cache.clear();
  devLog.log('Cache zones protégées vidé');
}

/**
 * Précharge les zones protégées (compatibilité - non utilisé dans la nouvelle version)
 */
export async function preloadRegionProtectedAreas(
  onProgress?: (message: string) => void
): Promise<{ success: boolean; areasCount: number; error?: string }> {
  devLog.log('⚠️ Préchargement région désactivé - chargement à la demande seulement');
  return { success: true, areasCount: 0 };
}
