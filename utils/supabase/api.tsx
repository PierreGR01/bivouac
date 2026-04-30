import { PoiLocation } from '../app/types';
import { projectId, publicAnonKey } from './info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-e51cba93`;

// Helper function to add timeout to fetch requests
// IMPORTANT: N'utilise PAS AbortController pour éviter les erreurs "broken pipe" côté serveur
// La requête continue en arrière-plan même après le timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 10000): Promise<Response> {
  const timeoutPromise = new Promise<Response>((_, reject) => {
    setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    // Race entre la requête et le timeout, mais ne cancel JAMAIS la requête fetch
    const response = await Promise.race([
      fetch(url, options),
      timeoutPromise
    ]);
    return response;
  } catch (error: any) {
    if (error.message?.includes('timeout')) {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw error;
  }
}

// Fetch all POIs from the server
export async function fetchPois(): Promise<PoiLocation[]> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/pois`, {
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    }, 15000); // 15 secondes timeout

    if (!response.ok) {
      console.error(`Failed to fetch POIs: ${response.status} ${response.statusText}`);
      return [];
    }

    const result = await response.json();
    
    if (result.success) {
      return result.data || [];
    } else {
      console.error('Failed to fetch POIs:', result.error);
      return [];
    }
  } catch (error) {
    console.error('Error fetching POIs from server:', error);
    // Retourner un tableau vide si le serveur n'est pas disponible
    return [];
  }
}

// Create a new POI
export async function createPoi(poi: PoiLocation): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/pois`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(poi),
    }, 15000); // 15 secondes timeout

    if (!response.ok) {
      console.error(`Failed to create POI: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Server response:', errorText);
      return false;
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('POI created successfully:', result.data);
      return true;
    } else {
      console.error('Failed to create POI:', result.error);
      return false;
    }
  } catch (error) {
    console.error('Error creating POI:', error);
    return false;
  }
}

// Delete a POI (optional for future use)
export async function deletePoi(id: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/pois/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    }, 10000); // 10 secondes timeout

    if (!response.ok) {
      throw new Error(`Failed to delete POI: ${response.statusText}`);
    }

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Error deleting POI:', error);
    return false;
  }
}

// Reset all POIs (delete all POIs from the database)
export async function resetPois(): Promise<{ success: boolean; deletedCount?: number }> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/pois`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    }, 20000); // 20 secondes timeout (peut contenir beaucoup de POIs)

    if (!response.ok) {
      console.error(`Failed to reset POIs: ${response.status} ${response.statusText}`);
      return { success: false };
    }

    const result = await response.json();
    
    if (result.success) {
      console.log(`Database reset: ${result.deletedCount} POIs deleted`);
      return { success: true, deletedCount: result.deletedCount };
    } else {
      console.error('Failed to reset POIs:', result.error);
      return { success: false };
    }
  } catch (error) {
    console.error('Error resetting POIs:', error);
    return { success: false };
  }
}

// Add a rating to a POI
export async function addRating(poiId: string, rating: number): Promise<PoiLocation | null> {
  try {
    const response = await fetchWithTimeout(`${BASE_URL}/pois/${poiId}/rate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rating }),
    }, 10000); // 10 secondes timeout

    if (!response.ok) {
      console.error(`Failed to add rating: ${response.status} ${response.statusText}`);
      return null;
    }

    const result = await response.json();
    
    if (result.success) {
      console.log('Rating added successfully:', result.data);
      return result.data;
    } else {
      console.error('Failed to add rating:', result.error);
      return null;
    }
  } catch (error) {
    console.error('Error adding rating:', error);
    return null;
  }
}

// Fetch altitude from Open-Elevation API
export async function fetchAltitude(lat: number, lng: number): Promise<number | null> {
  try {
    console.log(`🏔️ Tentative de récupération de l'altitude pour ${lat.toFixed(4)}, ${lng.toFixed(4)}...`);
    
    const response = await fetchWithTimeout(
      `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`,
      {},
      30000 // Augmenter le timeout à 30 secondes
    );

    if (!response.ok) {
      console.error(`Failed to fetch altitude: ${response.status} ${response.statusText}`);
      return null;
    }

    const result = await response.json();
    
    if (result.results && result.results.length > 0) {
      const altitude = Math.round(result.results[0].elevation);
      console.log(`✅ Altitude récupérée: ${altitude}m`);
      return altitude;
    } else {
      console.error('No altitude data found');
      return null;
    }
  } catch (error: any) {
    // Si timeout ou autre erreur, essayer une API alternative
    console.warn(`⚠️ Erreur avec Open-Elevation (${error.message}), tentative avec API alternative...`);
    
    try {
      // Essayer avec OpenTopoData comme fallback
      const response = await fetchWithTimeout(
        `https://api.opentopodata.org/v1/eudem25m?locations=${lat},${lng}`,
        {},
        20000 // 20 secondes pour l'API alternative
      );

      if (!response.ok) {
        console.error(`Failed to fetch altitude from fallback: ${response.status} ${response.statusText}`);
        return null;
      }

      const result = await response.json();
      
      if (result.results && result.results.length > 0 && result.results[0].elevation !== null) {
        const altitude = Math.round(result.results[0].elevation);
        console.log(`✅ Altitude récupérée (API alternative): ${altitude}m`);
        return altitude;
      } else {
        console.error('No altitude data found from fallback');
        return null;
      }
    } catch (fallbackError: any) {
      console.error('❌ Toutes les APIs d\'altitude ont échoué:', fallbackError.message);
      return null;
    }
  }
}