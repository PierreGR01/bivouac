import { supabaseClient } from './client';
import { PoiLocation } from '../../app/types';

const EDGE_FUNCTION_URL = import.meta.env.VITE_EDGE_FUNCTION_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function getAuthHeader(): Promise<string> {
  const session = await supabaseClient.auth.getSession();
  return `Bearer ${session.data.session?.access_token || ANON_KEY}`;
}

export async function fetchPois(): Promise<PoiLocation[]> {
  try {
    const response = await fetch(`${EDGE_FUNCTION_URL}/pois`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch POIs: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || data.pois || [];
  } catch (error) {
    console.error('Error fetching POIs:', error);
    return [];
  }
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
