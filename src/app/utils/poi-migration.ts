import { PoiLocation } from '../types';

// Forme (partielle, non garantie) des anciens POIs stockés avant l'introduction de
// waterProximity — d'où le typage large : ce sont des données legacy de forme incertaine,
// validées au runtime ci-dessous plutôt qu'au typage.
interface LegacyPoi {
  id?: unknown;
  position?: { lat?: unknown; lng?: unknown } | null;
  title?: unknown;
  description?: unknown;
  photos?: unknown;
  season?: unknown;
  regulations?: unknown;
  hasWater?: unknown;
  waterProximity?: unknown;
}

/**
 * Migre les anciens POIs avec hasWater vers le nouveau format avec waterProximity
 */
export function migratePoi(poi: LegacyPoi): PoiLocation | null {
  try {
    // Vérifier que les coordonnées sont valides
    if (!poi.position || 
        typeof poi.position.lat !== 'number' || 
        typeof poi.position.lng !== 'number' ||
        isNaN(poi.position.lat) || 
        isNaN(poi.position.lng)) {
      console.warn('POI avec coordonnées invalides ignoré:', poi);
      return null;
    }

    // Si le POI a déjà waterProximity, le retourner tel quel
    if ('waterProximity' in poi) {
      return poi as unknown as PoiLocation;
    }

    // Migrer hasWater vers waterProximity
    let waterProximity: 'proche' | 'éloigné' | null = null;
    
    if ('hasWater' in poi && poi.hasWater === true) {
      // Les anciens POIs avec hasWater=true sont considérés comme "proche"
      waterProximity = 'proche';
    }

    // Créer le nouveau POI avec waterProximity — cast nécessaire, ces champs viennent de
    // données non typées dont seule la position a été validée au runtime ci-dessus.
    const migratedPoi = {
      id: poi.id,
      position: poi.position,
      title: poi.title,
      description: poi.description,
      photos: poi.photos || [],
      season: poi.season,
      waterProximity,
      regulations: poi.regulations || '',
    } as unknown as PoiLocation;

    return migratedPoi;
  } catch (error) {
    console.error('Erreur lors de la migration du POI:', poi, error);
    return null;
  }
}

/**
 * Migre un tableau de POIs
 */
export function migratePois(pois: LegacyPoi[]): PoiLocation[] {
  return pois
    .map(migratePoi)
    .filter((poi): poi is PoiLocation => poi !== null);
}
