import L from 'leaflet';
import {
  loadFranceBorder,
  getFranceBorderSync,
  classifyTile,
  relevantRingsForTile,
  type Bbox,
  type FranceBorder,
} from './france-border';

// Résolution native maximale du SCAN25 (limite physique d'une carte papier au 1:25000) —
// au-delà, l'IGN lui-même bascule en interne vers un rendu vectoriel générique, donc on
// préfère basculer nous-mêmes vers Plan IGN v2 (gratuit, sans clé), net jusqu'au zoom 19.
const SCAN25_MAX_NATIVE_ZOOM = 16;
const PLANIGNV2_MAX_ZOOM = 19;
const TILE_SIZE = 256;

const SCAN25_ENDPOINT = 'https://data.geopf.fr/private/wmts';
const PLANIGNV2_ENDPOINT = 'https://data.geopf.fr/wmts';
const FALLBACK_SUBDOMAINS = ['a', 'b', 'c'];

// Précharge le contour dès le chargement du module — prêt bien avant que l'utilisateur
// n'atteigne une zone frontalière (voir france-border.ts).
loadFranceBorder();

function scan25TileUrl(apiKey: string, z: number, x: number, y: number): string {
  return `${SCAN25_ENDPOINT}?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN25TOUR&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}&FORMAT=image/jpeg&apikey=${apiKey}`;
}

function planIgnV2TileUrl(z: number, x: number, y: number): string {
  return `${PLANIGNV2_ENDPOINT}?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}&FORMAT=image/png`;
}

// Le SCAN25 IGN ne couvre que le territoire français : hors de ses limites, le service renvoie
// une tuile JPEG blanche valide (200 OK) plutôt qu'une erreur — le format ne supporte pas la
// transparence donc impossible de simplement superposer un fallback sans détection ou découpe.
function opentopomapTileUrl(z: number, x: number, y: number): string {
  const s = FALLBACK_SUBDOMAINS[(x + y) % FALLBACK_SUBDOMAINS.length];
  return `https://${s}.tile.opentopomap.org/${z}/${x}/${y}.png`;
}

// Filet de sécurité pour les tuiles classées "inside" par le contour (approximatif) : si une
// tuile pourtant censée être en France s'avère malgré tout blanche, on bascule sur OpenTopoMap.
// Scanne tous les pixels (pas un échantillon) pour ne pas confondre une zone peu texturée
// (vallée/plaine sans courbe de niveau visible) avec une vraie tuile hors couverture.
function isBlankTile(img: HTMLImageElement): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || TILE_SIZE;
    canvas.height = img.naturalHeight || TILE_SIZE;
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

function tileLon(x: number, z: number): number {
  return (x / Math.pow(2, z)) * 360 - 180;
}

function tileLat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function tileBbox(x: number, y: number, z: number): Bbox {
  return {
    minLon: tileLon(x, z),
    maxLon: tileLon(x + 1, z),
    minLat: tileLat(y + 1, z),
    maxLat: tileLat(y, z),
  };
}

// Projette un point lon/lat dans le repère pixel LOCAL de la tuile (x,y,z) — mêmes formules
// que la conversion lon/lat → tuile, mais sans arrondi puis mise à l'échelle sur 256px.
function lonLatToTilePixel(lon: number, lat: number, x: number, y: number, z: number): [number, number] {
  const n = Math.pow(2, z);
  const fracX = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const fracY = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return [(fracX - x) * TILE_SIZE, (fracY - y) * TILE_SIZE];
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

  private get internals(): TileLayerInternals {
    return this as unknown as TileLayerInternals;
  }

  private finalizeImgTile(tile: HTMLImageElement, src: string, done: L.DoneCallback): void {
    tile.removeAttribute('crossorigin');
    tile.onload = () => this.internals._tileOnLoad(done, tile);
    tile.onerror = (e) => this.internals._tileOnError(done, tile, e as unknown as Error);
    tile.src = src;
  }

  private simpleImgTile(src: string, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement('img');
    tile.alt = '';
    this.finalizeImgTile(tile, src, done);
    return tile;
  }

  // SCAN25 direct, avec filet de sécurité anti-tuile-blanche (cf. isBlankTile).
  private scan25Tile(x: number, y: number, z: number, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement('img');
    tile.alt = '';
    tile.crossOrigin = 'anonymous';
    tile.onload = () => {
      if (isBlankTile(tile)) {
        this.finalizeImgTile(tile, opentopomapTileUrl(z, x, y), done);
      } else {
        this.internals._tileOnLoad(done, tile);
      }
    };
    tile.onerror = () => this.finalizeImgTile(tile, opentopomapTileUrl(z, x, y), done);
    tile.src = scan25TileUrl(this.apiKey as string, z, x, y);
    return tile;
  }

  // Tuile à cheval sur la frontière : SCAN25 découpé au contour exact de la France, superposé
  // à OpenTopoMap (qui reste visible dans la portion hors-France de la tuile).
  private borderTile(x: number, y: number, z: number, bbox: Bbox, border: FranceBorder, done: L.DoneCallback): HTMLElement {
    const canvas = document.createElement('canvas');
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;

    const scan25Img = new Image();
    scan25Img.crossOrigin = 'anonymous';
    const baseImg = new Image();

    let pending = 2;
    let hasError = false;
    const onSettled = () => {
      pending--;
      if (pending > 0) return;
      const ctx = canvas.getContext('2d');
      if (!ctx || hasError) {
        this.internals._tileOnError(done, canvas, new Error('Tuile frontière IGN indisponible'));
        return;
      }
      ctx.drawImage(baseImg, 0, 0, TILE_SIZE, TILE_SIZE);
      ctx.save();
      const path = new Path2D();
      for (const { ring } of relevantRingsForTile(border, bbox)) {
        ring.forEach(([lon, lat], i) => {
          const [px, py] = lonLatToTilePixel(lon, lat, x, y, z);
          if (i === 0) path.moveTo(px, py);
          else path.lineTo(px, py);
        });
        path.closePath();
      }
      ctx.clip(path, 'evenodd');
      ctx.drawImage(scan25Img, 0, 0, TILE_SIZE, TILE_SIZE);
      ctx.restore();
      this.internals._tileOnLoad(done, canvas);
    };
    const onError = () => {
      hasError = true;
      onSettled();
    };

    scan25Img.onload = onSettled;
    scan25Img.onerror = onError;
    baseImg.onload = onSettled;
    baseImg.onerror = onError;
    scan25Img.src = scan25TileUrl(this.apiKey as string, z, x, y);
    baseImg.src = opentopomapTileUrl(z, x, y);

    return canvas;
  }

  protected createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const { x, y, z } = coords;
    const useScan25 = Boolean(this.apiKey) && z <= SCAN25_MAX_NATIVE_ZOOM;

    if (!useScan25) {
      return this.simpleImgTile(planIgnV2TileUrl(z, x, y), done);
    }

    const border = getFranceBorderSync();
    if (!border) {
      // Contour pas encore chargé (rare, seulement au tout premier rendu) — repli sûr.
      return this.scan25Tile(x, y, z, done);
    }

    const bbox = tileBbox(x, y, z);
    const classification = classifyTile(border, bbox);

    if (classification === 'outside') {
      return this.simpleImgTile(opentopomapTileUrl(z, x, y), done);
    }
    if (classification === 'inside') {
      return this.scan25Tile(x, y, z, done);
    }
    return this.borderTile(x, y, z, bbox, border, done);
  }
}

export function createIgnTopoLayer(apiKey: string | undefined, options?: L.TileLayerOptions): IgnTopoLayer {
  return new IgnTopoLayer(apiKey, options);
}
