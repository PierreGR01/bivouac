import { SpotPhoto } from '../types';

export function getPhotoUrl(photo: string | SpotPhoto): string {
  return typeof photo === 'string' ? photo : photo.url;
}

export function getPhotoCaption(photo: string | SpotPhoto): string | undefined {
  return typeof photo === 'string' ? undefined : photo.caption?.trim() || undefined;
}
