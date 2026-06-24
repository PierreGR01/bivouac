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

// Index global id→zone pour retrouver le nom des zones masquées sans requête réseau
const knownAreasById = new Map<string, ProtectedArea>();
export function getKnownArea(id: string): ProtectedArea | undefined {
  return knownAreasById.get(id);
}

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
    devLog.log('🔍 Requête zones protégées...');

    const edgeFunctionUrl = import.meta.env.VITE_EDGE_FUNCTION_URL;
    let data: any = null;

    const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

    // Priorité : proxy Edge Function (essaie aussi overpass.kumi.systems en fallback)
    if (edgeFunctionUrl && anonKey) {
      const proxyController = new AbortController();
      const proxyTimer = setTimeout(() => proxyController.abort(), 15000);
      try {
        const proxyResp = await fetch(`${edgeFunctionUrl}/protected-areas`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ south, west, north, east, timeout }),
          signal: proxyController.signal,
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
      } finally {
        clearTimeout(proxyTimer);
      }
    }

    // Fallback : appel direct Overpass — contrôleur indépendant du proxy
    if (!data) {
      const fallbackController = new AbortController();
      const fallbackTimer = setTimeout(() => fallbackController.abort(), (timeout + 5) * 1000);
      try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: query,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          signal: fallbackController.signal,
        });

        if (!response.ok) {
          if (response.status === 504) throw new Error('Overpass timeout - zone trop complexe');
          if (response.status === 429) throw new Error('Overpass rate limit - trop de requêtes');
          throw new Error(`Overpass erreur ${response.status}`);
        }
        data = await response.json();
      } finally {
        clearTimeout(fallbackTimer);
      }
    }
    const areas = parseProtectedAreas(data);

    // Mettre en cache
    cache.set(cacheKey, {
      data: areas,
      timestamp: Date.now(),
      bounds: cacheKey,
    });

    areas.forEach(a => knownAreasById.set(a.id, a));
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
 * Recherche les zones OSM proches d'un point (lat/lng) — retourne uniquement
 * les noms et IDs, sans géométrie. Pour alimenter un dropdown admin.
 * Passe par l'edge function (serveur) pour éviter les problèmes CORS/CSP,
 * avec fallback direct Overpass si non disponible.
 */
export async function searchNearbyOsmZones(
  lat: number,
  lng: number,
): Promise<{ id: string; name: string }[]> {
  const delta = 0.6;
  const south = lat - delta, north = lat + delta;
  const west = lng - delta, east = lng + delta;

  const edgeFunctionUrl = import.meta.env.VITE_EDGE_FUNCTION_URL;
  const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

  let elements: any[] = [];

  if (edgeFunctionUrl && anonKey) {
    try {
      const resp = await fetch(`${edgeFunctionUrl}/protected-areas-names`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
        body: JSON.stringify({ south, west, north, east }),
      });
      if (resp.ok) {
        const result = await resp.json();
        if (result.success && result.data?.elements) elements = result.data.elements;
      }
    } catch { /* fallback */ }
  }

  // Fallback direct Overpass (out tags = rapide, pas de géométrie)
  if (elements.length === 0) {
    const bbox = `${south},${west},${north},${east}`;
    const query = `[out:json][timeout:15];(relation["boundary"="national_park"](${bbox});relation["boundary"="protected_area"](${bbox});relation["leisure"="nature_reserve"](${bbox}););out tags;`;
    try {
      const resp = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      if (resp.ok) {
        const data = await resp.json();
        elements = data.elements ?? [];
      }
    } catch { /* vide */ }
  }

  return elements
    .filter((el: any) => el.type === 'relation')
    .map((el: any) => ({
      id: `osm-${el.type}-${el.id}`,
      name: el.tags?.name || el.tags?.['name:fr'] || el.tags?.protection_title || '',
    }))
    .filter((c: { id: string; name: string }) => c.name);
}

interface WaySegment {
  nodeIds: number[];
  coords: number[][];
}

/**
 * Assemble des segments OSM en anneaux GeoJSON fermés.
 * Utilise les node IDs (champ `nodes` de la réponse Overpass) pour l'appariement
 * des extrémités — 100% fiable, indépendant de la précision flottante des coordonnées.
 */
function assembleGeoJSONRings(ways: WaySegment[]): number[][][] {
  if (ways.length === 0) return [];

  const rings: number[][][] = [];
  const remaining = ways.map(w => ({ nodeIds: [...w.nodeIds], coords: [...w.coords] }));

  while (remaining.length > 0) {
    const cur = remaining.shift()!;
    let nodeIds = [...cur.nodeIds];
    let coords = [...cur.coords];

    let changed = true;
    while (changed && remaining.length > 0) {
      changed = false;
      for (let i = 0; i < remaining.length; i++) {
        const w = remaining[i];
        const rEnd = nodeIds[nodeIds.length - 1];
        const rStart = nodeIds[0];
        const wStart = w.nodeIds[0];
        const wEnd = w.nodeIds[w.nodeIds.length - 1];

        if (rEnd === wStart) {
          nodeIds.push(...w.nodeIds.slice(1));
          coords.push(...w.coords.slice(1));
          remaining.splice(i, 1); changed = true; break;
        } else if (rEnd === wEnd) {
          nodeIds.push(...[...w.nodeIds].reverse().slice(1));
          coords.push(...[...w.coords].reverse().slice(1));
          remaining.splice(i, 1); changed = true; break;
        } else if (rStart === wEnd) {
          nodeIds.unshift(...w.nodeIds.slice(0, -1));
          coords.unshift(...w.coords.slice(0, -1));
          remaining.splice(i, 1); changed = true; break;
        } else if (rStart === wStart) {
          nodeIds.unshift(...[...w.nodeIds].reverse().slice(0, -1));
          coords.unshift(...[...w.coords].reverse().slice(0, -1));
          remaining.splice(i, 1); changed = true; break;
        }
      }
    }

    // Fermer l'anneau (GeoJSON : premier = dernier)
    if (nodeIds[0] !== nodeIds[nodeIds.length - 1]) {
      coords.push([...coords[0]]);
    }
    if (coords.length >= 4) rings.push(coords);
  }

  return rings;
}

/**
 * Convertit le JSON brut Overpass en GeoJSON Feature directement.
 *
 * Pour une relation : la requête retourne les outer ways comme éléments individuels
 * (query: relation(id)->.r;way(r.r:"outer");out geom;)
 * → on collecte tous les way elements et on les assemble.
 *
 * Pour un way : retourne l'unique way element.
 */
function overpassToGeoJSON(data: any, type: string, id: string): GeoJSON.Feature | null {
  if (!data?.elements) return null;

  if (type === 'relation') {
    // Collecte tous les way elements avec géométrie ET node IDs (= les outer ways retournés par la requête)
    const outerWays: WaySegment[] = data.elements
      .filter((e: any) => e.type === 'way' && Array.isArray(e.nodes) && Array.isArray(e.geometry) && e.geometry.length >= 2)
      .map((e: any) => ({
        nodeIds: e.nodes as number[],
        coords: e.geometry.map((p: any) => [p.lon, p.lat]),
      }));

    if (outerWays.length === 0) return null;

    const rings = assembleGeoJSONRings(outerWays);
    if (rings.length === 0) return null;

    return {
      type: 'Feature',
      properties: {},
      geometry: rings.length === 1
        ? { type: 'Polygon', coordinates: [rings[0]] } as GeoJSON.Polygon
        : { type: 'MultiPolygon', coordinates: rings.map(r => [r]) } as GeoJSON.MultiPolygon,
    };
  }

  if (type === 'way') {
    const numId = parseInt(id, 10);
    const way = data.elements.find((e: any) => e.type === 'way' && e.id === numId);
    if (!Array.isArray(way?.geometry) || way.geometry.length < 3) return null;
    const coords: number[][] = way.geometry.map((p: any) => [p.lon, p.lat]);
    if (Math.abs(coords[0][0] - coords[coords.length - 1][0]) > 0.000001 ||
        Math.abs(coords[0][1] - coords[coords.length - 1][1]) > 0.000001) {
      coords.push([...coords[0]]);
    }
    return {
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates: [coords] } as GeoJSON.Polygon,
    };
  }

  return null;
}

/**
 * Récupère une zone OSM spécifique par son ID (format "osm-relation-1024498").
 * Retourne directement un GeoJSON Feature pour mise à jour de custom zone.
 */
export async function fetchOsmZoneById(osmId: string): Promise<GeoJSON.Feature | null> {
  const parts = osmId.split('-');
  if (parts.length < 3) return null;
  const type = parts[1]; // 'relation' ou 'way'
  const id = parts.slice(2).join('-');

  // Pour une relation : récupère les outer ways directement comme éléments individuels
  const query = type === 'relation'
    ? `[out:json][timeout:60];relation(${id})->.r;way(r.r:"outer");out geom;`
    : `[out:json][timeout:15];way(${id});out geom;`;

  try {
    const edgeFunctionUrl = import.meta.env.VITE_EDGE_FUNCTION_URL;
    const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
    let data: any = null;

    if (edgeFunctionUrl && anonKey) {
      const proxyCtrl = new AbortController();
      const proxyTimer = setTimeout(() => proxyCtrl.abort(), 10000);
      try {
        const resp = await fetch(`${edgeFunctionUrl}/protected-areas-by-id`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
          body: JSON.stringify({ type, id }),
          signal: proxyCtrl.signal,
        });
        if (resp.ok) {
          const result = await resp.json();
          if (result.success) data = result.data;
        }
      } catch { /* fallback direct */ } finally {
        clearTimeout(proxyTimer);
      }
    }

    if (!data) {
      const MIN_OVERPASS_GAP = 65000;
      const elapsed = Date.now() - lastRequestTime;
      if (elapsed < MIN_OVERPASS_GAP) {
        const wait = MIN_OVERPASS_GAP - elapsed;
        devLog.log(`⏱️ Pause rate-limit Overpass (${Math.ceil(wait / 1000)}s)...`);
        await new Promise(r => setTimeout(r, wait));
      }
      lastRequestTime = Date.now();

      const overpassCtrl = new AbortController();
      const overpassTimer = setTimeout(() => overpassCtrl.abort(), 65000);
      try {
        const resp = await fetch('https://overpass-api.de/api/interpreter', {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          signal: overpassCtrl.signal,
        });
        if (resp.status === 429) throw new Error('API Overpass surchargée — attends 60 secondes et réessaie');
        if (!resp.ok) throw new Error(`Overpass erreur ${resp.status}`);
        data = await resp.json();
      } finally {
        clearTimeout(overpassTimer);
      }
    }

    return overpassToGeoJSON(data, type, id);
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
