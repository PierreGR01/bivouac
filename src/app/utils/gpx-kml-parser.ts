export interface RoutePoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// Distance perpendiculaire (en mètres) du point p au segment [a,b], via une projection
// équirectangulaire locale (suffisamment précise à l'échelle d'une trace GPX).
function perpendicularDistanceMeters(p: RoutePoint, a: RoutePoint, b: RoutePoint): number {
  const cosLat = Math.cos(toRad(a.lat));
  const toXY = (pt: RoutePoint) => ({
    x: toRad(pt.lng - a.lng) * EARTH_RADIUS_M * cosLat,
    y: toRad(pt.lat - a.lat) * EARTH_RADIUS_M,
  });

  const A = toXY(a);
  const B = toXY(b);
  const P = toXY(p);

  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.sqrt((P.x - A.x) ** 2 + (P.y - A.y) ** 2);

  const t = Math.max(0, Math.min(1, ((P.x - A.x) * dx + (P.y - A.y) * dy) / lengthSquared));
  const projX = A.x + t * dx;
  const projY = A.y + t * dy;
  return Math.sqrt((P.x - projX) ** 2 + (P.y - projY) ** 2);
}

// Douglas-Peucker itératif (pas de récursion sur de gros tracés) : ne retire que les points
// quasi-alignés à moins de `toleranceMeters` de la ligne, donc la forme du tracé est préservée.
function douglasPeucker(points: RoutePoint[], toleranceMeters: number): RoutePoint[] {
  const n = points.length;
  if (n < 3) return points;

  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;

  const stack: Array<[number, number]> = [[0, n - 1]];
  while (stack.length > 0) {
    const [startIdx, endIdx] = stack.pop()!;
    const first = points[startIdx];
    const last = points[endIdx];

    let maxDist = 0;
    let maxIndex = -1;
    for (let i = startIdx + 1; i < endIdx; i++) {
      const dist = perpendicularDistanceMeters(points[i], first, last);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }

    if (maxDist > toleranceMeters && maxIndex !== -1) {
      keep[maxIndex] = 1;
      stack.push([startIdx, maxIndex]);
      stack.push([maxIndex, endIdx]);
    }
  }

  const result: RoutePoint[] = [];
  for (let i = 0; i < n; i++) {
    if (keep[i]) result.push(points[i]);
  }
  return result;
}

// En dessous de la précision GPS habituelle d'une trace de rando/trail (~5-10m) : le tracé
// simplifié reste visuellement et géométriquement identique à l'original.
const SIMPLIFY_TOLERANCE_METERS = 5;
// Filet de sécurité pour les tracés exceptionnellement sinueux où la tolérance ci-dessus
// ne suffirait pas à revenir sous un nombre de points raisonnable pour l'affichage.
const MAX_POINTS_HARD_CAP = 3000;

function simplifyTrack(points: RoutePoint[]): RoutePoint[] {
  if (points.length <= 2) return points;

  let simplified = douglasPeucker(points, SIMPLIFY_TOLERANCE_METERS);

  if (simplified.length > MAX_POINTS_HARD_CAP) {
    const stride = Math.ceil(simplified.length / MAX_POINTS_HARD_CAP);
    const strided = simplified.filter((_, i) => i % stride === 0);
    const lastPoint = simplified[simplified.length - 1];
    if (strided[strided.length - 1] !== lastPoint) strided.push(lastPoint);
    simplified = strided;
  }

  return simplified;
}

function parseGpx(doc: Document): RoutePoint[] {
  // Un fichier GPX peut contenir plusieurs traces (trkpt) ou un itinéraire simple (rtept).
  const nodes = doc.querySelectorAll('trkpt, rtept');
  const points: RoutePoint[] = [];
  nodes.forEach((node) => {
    const lat = parseFloat(node.getAttribute('lat') || '');
    const lng = parseFloat(node.getAttribute('lon') || '');
    if (isFinite(lat) && isFinite(lng)) points.push({ lat, lng });
  });
  return points;
}

function parseKml(doc: Document): RoutePoint[] {
  // Concatène tous les <coordinates> trouvés (LineString, Point, etc.) : "lng,lat[,alt] ..."
  const nodes = doc.querySelectorAll('coordinates');
  const points: RoutePoint[] = [];
  nodes.forEach((node) => {
    const text = node.textContent || '';
    text.trim().split(/\s+/).forEach((tuple) => {
      const [lngStr, latStr] = tuple.split(',');
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      if (isFinite(lat) && isFinite(lng)) points.push({ lat, lng });
    });
  });
  return points;
}

export function parseGpxOrKml(text: string, filename: string): RoutePoint[] {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('Fichier invalide ou mal formé');
  }

  const isGpx = filename.toLowerCase().endsWith('.gpx') || !!doc.querySelector('gpx');
  const points = isGpx ? parseGpx(doc) : parseKml(doc);

  if (points.length === 0) {
    throw new Error('Aucun point de tracé trouvé dans ce fichier');
  }
  return simplifyTrack(points);
}
