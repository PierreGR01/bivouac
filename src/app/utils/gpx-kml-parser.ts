export interface RoutePoint {
  lat: number;
  lng: number;
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
  return points;
}
