import { supabaseClient } from './client';
import { PoiLocation, PoiAdminSummary, Review } from '../../app/types';

const EDGE_FUNCTION_URL = import.meta.env.VITE_EDGE_FUNCTION_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function getAuthHeader(): Promise<string> {
  const session = await supabaseClient.auth.getSession();
  return `Bearer ${session.data.session?.access_token || ANON_KEY}`;
}

export interface PoisBbox {
  south: number;
  west: number;
  north: number;
  east: number;
}

// Liste allégée des spots (carte) — `bbox` scope la requête à une zone géographique
// (la carte ne charge que ce qui est visible + marge, cf. Phase 4). Omis = tout renvoyer
// (comportement historique, gardé côté serveur pour compat).
// Ne catch PAS les erreurs (les laisse remonter) : un bbox légitimement vide (zone sans
// spot) doit rester distinguable d'un échec réseau côté appelant (usePois.ts décide du
// fallback approprié — mockLocations seulement en cas d'échec, jamais pour un [] valide).
export async function fetchPois(bbox?: PoisBbox): Promise<PoiLocation[]> {
  // Requête authentifiée (quand l'utilisateur est connecté) pour que le serveur puisse
  // filtrer les spots privés en fonction du demandeur (propriétaire/admin vs tiers).
  const authHeader = await getAuthHeader();
  const params = bbox
    ? `?${new URLSearchParams({
        south: String(bbox.south), west: String(bbox.west),
        north: String(bbox.north), east: String(bbox.east),
      }).toString()}`
    : '';
  const response = await fetch(`${EDGE_FUNCTION_URL}/pois${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch POIs: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || data.pois || [];
}

// Spots créés par l'utilisateur courant — indépendant de la zone de carte affichée
// (utilisé par l'onglet "Mes spots" du dashboard).
export async function fetchMyPois(): Promise<PoiLocation[]> {
  const authHeader = await getAuthHeader();
  const response = await fetch(`${EDGE_FUNCTION_URL}/pois/mine`, {
    method: 'GET',
    headers: { 'Authorization': authHeader },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Failed to fetch my POIs: ${response.statusText}`);
  const body = await response.json();
  return body.data ?? [];
}

// Résout un ensemble d'ids de spots (ex: favoris) indépendamment de la zone de carte
// affichée.
export async function fetchPoisByIds(ids: string[]): Promise<PoiLocation[]> {
  if (ids.length === 0) return [];
  const authHeader = await getAuthHeader();
  const params = new URLSearchParams({ ids: ids.join(',') });
  const response = await fetch(`${EDGE_FUNCTION_URL}/pois/by-ids?${params.toString()}`, {
    method: 'GET',
    headers: { 'Authorization': authHeader },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Failed to fetch POIs by ids: ${response.statusText}`);
  const body = await response.json();
  return body.data ?? [];
}

export interface PoiAdminListPage {
  data: PoiAdminSummary[];
  nextCursor: string | null;
  total: number;
}

// Liste paginée pour le tableau de bord admin (super-admin: toute la plateforme :
// admin de zone: son/ses territoire(s)) — ne charge jamais les champs lourds des spots.
export async function fetchAdminPoisPage(cursor: string | null, limit = 50): Promise<PoiAdminListPage> {
  const authHeader = await getAuthHeader();
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  const response = await fetch(`${EDGE_FUNCTION_URL}/pois/admin-list?${params.toString()}`, {
    method: 'GET',
    headers: { 'Authorization': authHeader },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Failed to fetch admin POI list: ${response.statusText}`);
  }
  const body = await response.json();
  return { data: body.data ?? [], nextCursor: body.nextCursor ?? null, total: body.total ?? 0 };
}

// Détail complet d'un spot (photos, reviews, description, regulations, zoneGeometry) —
// GET /pois (liste) ne renvoie plus ces champs, ce fetch est nécessaire à l'ouverture.
export async function fetchPoiDetail(poiId: string): Promise<PoiLocation | null> {
  try {
    const authHeader = await getAuthHeader();
    const response = await fetch(`${EDGE_FUNCTION_URL}/pois/${poiId}`, {
      method: 'GET',
      headers: { 'Authorization': authHeader },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch POI detail: ${response.statusText}`);
    }
    const body = await response.json();
    return body.data ?? null;
  } catch (error) {
    console.error('Error fetching POI detail:', error);
    return null;
  }
}

export interface MyReviewEntry {
  review: Review;
  reviewKey: string;
  poiId: string;
  poiTitle: string;
  poiPosition: { lat: number; lng: number };
}

// Avis postés par l'utilisateur courant, à travers tous les spots — utilisé par
// l'onglet "Mes avis" du dashboard (GET /pois ne renvoie plus les reviews par spot).
export async function fetchMyReviews(): Promise<MyReviewEntry[]> {
  const authHeader = await getAuthHeader();
  const response = await fetch(`${EDGE_FUNCTION_URL}/pois/my-reviews`, {
    method: 'GET',
    headers: { 'Authorization': authHeader },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch my reviews: ${response.statusText}`);
  }
  const body = await response.json();
  return body.data ?? [];
}

// Upload d'une photo compressée vers Supabase Storage (bucket public `spot-photos`) —
// remplace le stockage base64 inline. Retourne l'URL publique à utiliser comme
// `SpotPhoto.url`.
export async function uploadPhoto(blob: Blob): Promise<string> {
  const authHeader = await getAuthHeader();
  const response = await fetch(`${EDGE_FUNCTION_URL}/photos/upload`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': blob.type || 'image/jpeg',
    },
    body: blob,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Failed to upload photo: ${response.statusText}`);
  }
  const body = await response.json();
  return body.url;
}

export async function createPoi(poi: Partial<PoiLocation>): Promise<boolean> {
  try {
    const authHeader = await getAuthHeader();
    const response = await fetch(`${EDGE_FUNCTION_URL}/pois`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(poi),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = body?.error || `Failed to create POI: ${response.statusText}`;
      throw new Error(message);
    }

    return true;
  } catch (error) {
    console.error('Error creating POI:', error);
    throw error;
  }
}

export async function enrichPoi(poiId: string, enrichment: { altitude?: number | null; waterProximity?: 'proche' | 'éloigné' | null; naturalWaterProximity?: 'proche' | null }): Promise<boolean> {
  try {
    const response = await fetch(`${EDGE_FUNCTION_URL}/pois/${poiId}/enrich`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify(enrichment),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Failed to enrich POI: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error enriching POI:', error);
    return false;
  }
}

export async function updatePoi(poiId: string, updates: Partial<PoiLocation>): Promise<boolean> {
  try {
    const authHeader = await getAuthHeader();
    const response = await fetch(`${EDGE_FUNCTION_URL}/pois/${poiId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(updates),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Failed to update POI: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error updating POI:', error);
    return false;
  }
}

export async function deletePoi(poiId: string): Promise<void> {
  try {
    const authHeader = await getAuthHeader();
    const response = await fetch(`${EDGE_FUNCTION_URL}/pois/${poiId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete POI: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error deleting POI:', error);
    throw error;
  }
}

export async function deleteReview(poiId: string, createdAt: string): Promise<PoiLocation | null> {
  try {
    const authHeader = await getAuthHeader();
    const response = await fetch(
      `${EDGE_FUNCTION_URL}/pois/${poiId}/reviews/${encodeURIComponent(createdAt)}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': authHeader },
        signal: AbortSignal.timeout(30_000),
      }
    );
    if (!response.ok) throw new Error(`Failed to delete review: ${response.statusText}`);
    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error('Error deleting review:', error);
    throw error;
  }
}

export async function addRating(poiId: string, rating: number, comment: string): Promise<PoiLocation | null> {
  try {
    const authHeader = await getAuthHeader();
    const response = await fetch(`${EDGE_FUNCTION_URL}/pois/${poiId}/rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ rating, comment }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Failed to add rating: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || data.poi || null;
  } catch (error) {
    console.error('Error adding rating:', error);
    throw error;
  }
}

export async function recordPoiView(poiId: string): Promise<void> {
  try {
    await fetch(`${EDGE_FUNCTION_URL}/pois/${poiId}/view`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ANON_KEY}` },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    // Best-effort analytics — never surface a failure to the user.
    console.error('Error recording POI view:', error);
  }
}

export async function fetchPoiViews30d(): Promise<Record<string, number>> {
  try {
    const authHeader = await getAuthHeader();
    const response = await fetch(`${EDGE_FUNCTION_URL}/pois/views-30d`, {
      method: 'GET',
      headers: { 'Authorization': authHeader },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Failed to fetch POI views: ${response.statusText}`);
    const data = await response.json();
    return data.data || {};
  } catch (error) {
    console.error('Error fetching POI views:', error);
    return {};
  }
}

export async function fetchAltitude(lat: number, lng: number): Promise<number | null> {
  try {
    const response = await fetch(`${EDGE_FUNCTION_URL}/altitude?lat=${lat}&lng=${lng}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch altitude: ${response.statusText}`);
    }

    const data = await response.json();
    return data.altitude || null;
  } catch (error) {
    console.error('Error fetching altitude:', error);
    return null;
  }
}

export async function resetPois(): Promise<boolean> {
  try {
    const authHeader = await getAuthHeader();
    const response = await fetch(`${EDGE_FUNCTION_URL}/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Failed to reset POIs: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error('Error resetting POIs:', error);
    throw error;
  }
}
