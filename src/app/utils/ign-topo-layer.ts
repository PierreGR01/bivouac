import L from 'leaflet';

// Résolution native maximale du SCAN25 (limite physique d'une carte papier au 1:25000) —
// au-delà, l'IGN lui-même bascule en interne vers un rendu vectoriel générique, donc on
// préfère basculer nous-mêmes vers Plan IGN v2 (gratuit, sans clé), net jusqu'au zoom 19.
const SCAN25_MAX_NATIVE_ZOOM = 16;
const PLANIGNV2_MAX_ZOOM = 19;

const SCAN25_ENDPOINT = 'https://data.geopf.fr/private/wmts';
const PLANIGNV2_ENDPOINT = 'https://data.geopf.fr/wmts';
const FALLBACK_SUBDOMAINS = ['a', 'b', 'c'];

function scan25TileUrl(apiKey: string, z: number, x: number, y: number): string {
  return `${SCAN25_ENDPOINT}?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN25TOUR&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}&FORMAT=image/jpeg&apikey=${apiKey}`;
}

function planIgnV2TileUrl(z: number, x: number, y: number): string {
  return `${PLANIGNV2_ENDPOINT}?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}&FORMAT=image/png`;
}

// Le SCAN25 IGN ne couvre que le territoire français : hors de ses limites (Italie, Espagne,
// Suisse...), le service renvoie une tuile JPEG blanche valide (200 OK) plutôt qu'une erreur —
// le format ne supporte pas la transparence donc impossible de simplement superposer un fallback.
function opentopomapTileUrl(z: number, x: number, y: number): string {
  const s = FALLBACK_SUBDOMAINS[(x + y) % FALLBACK_SUBDOMAINS.length];
  return `https://${s}.tile.opentopomap.org/${z}/${x}/${y}.png`;
}

// Détecte une tuile SCAN25 hors couverture France (100% unie, blanche) sans se faire piéger
// par une tuile réelle mais peu texturée (fond de vallée/plaine avec peu de courbes de niveau) —
// on scanne donc TOUS les pixels plutôt qu'un échantillon de points, qui peut par hasard
// tomber uniquement sur du blanc même sur une tuile valide. Un seul pixel non-blanc suffit à
// prouver qu'il y a de la vraie donnée cartographique (courbe, route, texte...).
// Nécessite crossOrigin sur l'image — l'IGN autorise le CORS (access-control-allow-origin: *).
function isBlankTile(img: HTMLImageElement): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 256;
    canvas.height = img.naturalHeight || 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) {
        return false;
      }
    }
    return true;
  } catch {
    // Lecture de pixels bloquée (CORS, etc.) — on garde la tuile plutôt que de planter.
    return false;
  }
}

// _tileOnLoad/_tileOnError sont protégées chez Leaflet mais non exposées par les types —
// on les type ici pour garder le bind correct (compteur de tuiles en cours, fade-in, etc.)
// plutôt que de réimplémenter cette logique interne.
type TileLayerInternals = {
  _tileOnLoad(done: L.DoneCallback, tile: HTMLElement): void;
  _tileOnError(done: L.DoneCallback, tile: HTMLElement, e: Error): void;
};

export class IgnTopoLayer extends L.TileLayer {
  private apiKey?: string;

  constructor(apiKey: string | undefined, options?: L.TileLayerOptions) {
    super('', {
      maxZoom: PLANIGNV2_MAX_ZOOM,
      attribution:
        '&copy; <a href="https://www.ign.fr" target="_blank" rel="noopener">IGN-F/Geoportail</a> (SCAN 25&reg; Touristique / Plan IGN v2) | &copy; OpenStreetMap contributors, OpenTopoMap (hors France)',
      ...options,
    });
    this.apiKey = apiKey;
  }

  protected createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const { x, y, z } = coords;
    const tile = document.createElement('img');
    tile.alt = '';
    const internals = this as unknown as TileLayerInternals;

    const useScan25 = Boolean(this.apiKey) && z <= SCAN25_MAX_NATIVE_ZOOM;

    const loadAsFinalTile = (src: string, crossOrigin: boolean) => {
      if (crossOrigin) {
        tile.crossOrigin = 'anonymous';
      } else {
        tile.removeAttribute('crossorigin');
      }
      tile.onload = () => internals._tileOnLoad(done, tile);
      tile.onerror = (e) => internals._tileOnError(done, tile, e as unknown as Error);
      tile.src = src;
    };

    if (useScan25) {
      // crossOrigin requis pour pouvoir lire les pixels et détecter une tuile blanche
      tile.crossOrigin = 'anonymous';
      tile.onload = () => {
        if (isBlankTile(tile)) {
          loadAsFinalTile(opentopomapTileUrl(z, x, y), false);
        } else {
          internals._tileOnLoad(done, tile);
        }
      };
      tile.onerror = () => loadAsFinalTile(opentopomapTileUrl(z, x, y), false);
      tile.src = scan25TileUrl(this.apiKey as string, z, x, y);
    } else {
      loadAsFinalTile(planIgnV2TileUrl(z, x, y), false);
    }

    return tile;
  }
}

export function createIgnTopoLayer(apiKey: string | undefined, options?: L.TileLayerOptions): IgnTopoLayer {
  return new IgnTopoLayer(apiKey, options);
}
