export interface SpotPhoto {
  url: string;
  // Vignette légère (générée à l'upload) pour l'affichage compact dans la fiche spot —
  // absente sur les photos migrées avant l'introduction des vignettes (repli sur `url`).
  thumbUrl?: string;
  caption?: string;
}

export interface PoiLocation {
  id: string;
  position: {
    lat: number;
    lng: number;
  };
  title: string;
  description: string;
  photos: (string | SpotPhoto)[]; // legacy spots store plain URL strings, new ones store SpotPhoto
  season: 'hiver' | 'été' | 'toute-annee';
  waterProximity: 'proche' | 'éloigné' | null; // proche: <100m, éloigné: 100-200m, null: >200m
  naturalWaterProximity?: 'proche' | null; // cours d'eau / lac naturel dans un rayon de 200m
  regulations: string;
  altitude?: number; // Altitude en mètres (récupérée automatiquement)
  capacity?: '1' | '2-3' | '4-5' | '5+'; // Capacité d'accueil en nombre de tentes
  difficulty?: number; // Difficulté d'accès (0-5)
  ratings?: number[]; // Notes des utilisateurs (0-5) — legacy
  reviews?: Review[]; // Avis complets (note + commentaire)
  disabledUntil?: string | null; // ISO 8601 — date de fin de désactivation temporaire, null/absent = actif
  createdBy?: string; // ID de l'utilisateur créateur (dérivé côté serveur, absent sur les spots legacy)
  createdAt?: string; // ISO 8601 — date de création (dérivée côté serveur, absente sur les spots legacy)
  zoneGeometry?: GeoJSON.Feature | null; // Zone optionnelle (≤2000m², doit contenir le point), affichée seulement quand le spot est sélectionné
  isPublic?: boolean; // absent/undefined = public (comportement legacy) ; false = visible uniquement par le créateur et les admins
}

// Ligne allégée renvoyée par GET /pois/admin-list — pas de champs lourds (photos,
// reviews, description, regulations, zoneGeometry), juste ce qu'il faut pour afficher
// une ligne de tableau admin à l'échelle d'un territoire ou de toute la plateforme.
export interface PoiAdminSummary {
  id: string;
  position: { lat: number; lng: number };
  title: string;
  isPublic: boolean;
  disabledUntil?: string | null;
  createdBy?: string;
  createdAt: string;
  photosCount: number;
}

export interface Review {
  rating: number;
  comment: string;
  createdAt: string; // ISO 8601
  userId?: string; // ID de l'utilisateur auteur (dérivé côté serveur, absent sur les avis legacy)
}