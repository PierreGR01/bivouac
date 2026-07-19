export interface SpotPhoto {
  url: string;
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
}

export interface Review {
  rating: number;
  comment: string;
  createdAt: string; // ISO 8601
  userId?: string; // ID de l'utilisateur auteur (dérivé côté serveur, absent sur les avis legacy)
}