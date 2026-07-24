import { SpotPhoto } from '../types';

export function getPhotoUrl(photo: string | SpotPhoto): string {
  return typeof photo === 'string' ? photo : photo.url;
}

// Vignette légère pour l'affichage compact (fiche spot) — repli sur l'image complète pour
// les photos migrées avant l'introduction des vignettes (pas de thumbUrl).
export function getPhotoThumbUrl(photo: string | SpotPhoto): string {
  return typeof photo === 'string' ? photo : (photo.thumbUrl ?? photo.url);
}

export function getPhotoCaption(photo: string | SpotPhoto): string | undefined {
  return typeof photo === 'string' ? undefined : photo.caption?.trim() || undefined;
}
