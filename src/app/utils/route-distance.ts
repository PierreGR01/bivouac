const EARTH_RADIUS_KM = 6371;

function distanceToSegment(
  point: { lat: number; lng: number },
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
): number {
  const lat1 = start.lat * Math.PI / 180;
  const lng1 = start.lng * Math.PI / 180;
  const lat2 = end.lat * Math.PI / 180;
  const lng2 = end.lng * Math.PI / 180;
  const latP = point.lat * Math.PI / 180;
  const lngP = point.lng * Math.PI / 180;

  const distToStart = EARTH_RADIUS_KM * Math.acos(
    Math.sin(lat1) * Math.sin(latP) +
    Math.cos(lat1) * Math.cos(latP) * Math.cos(lngP - lng1)
  );
  const distToEnd = EARTH_RADIUS_KM * Math.acos(
    Math.sin(lat2) * Math.sin(latP) +
    Math.cos(lat2) * Math.cos(latP) * Math.cos(lngP - lng2)
  );

  const segmentLength = EARTH_RADIUS_KM * Math.acos(
    Math.sin(lat1) * Math.sin(lat2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1)
  );

  if (segmentLength < 0.001) return Math.min(distToStart, distToEnd);

  const u = ((latP - lat1) * (lat2 - lat1) + (lngP - lng1) * (lng2 - lng1)) /
            ((lat2 - lat1) ** 2 + (lng2 - lng1) ** 2);

  if (u < 0) return distToStart;
  if (u > 1) return distToEnd;

  const projLat = lat1 + u * (lat2 - lat1);
  const projLng = lng1 + u * (lng2 - lng1);

  return EARTH_RADIUS_KM * Math.acos(
    Math.sin(latP) * Math.sin(projLat) +
    Math.cos(latP) * Math.cos(projLat) * Math.cos(projLng - lngP)
  );
}

export function distanceToRoute(
  point: { lat: number; lng: number },
  route: Array<{ lat: number; lng: number }>
): number {
  if (route.length < 2) return Infinity;
  let minDistance = Infinity;
  for (let i = 0; i < route.length - 1; i++) {
    minDistance = Math.min(minDistance, distanceToSegment(point, route[i], route[i + 1]));
  }
  return minDistance;
}

// Boîte englobante d'un tracé, élargie de `bufferKm` dans toutes les directions —
// utilisée pour interroger une zone couvrant tout le parcours (ex: points d'eau à proximité).
export function getRouteBounds(
  route: Array<{ lat: number; lng: number }>,
  bufferKm: number
): { south: number; west: number; north: number; east: number } {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of route) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const avgLat = (minLat + maxLat) / 2;
  const latBufferDeg = bufferKm / 111;
  const lngBufferDeg = bufferKm / (111 * Math.max(Math.cos(avgLat * Math.PI / 180), 0.01));

  return {
    south: minLat - latBufferDeg,
    west: minLng - lngBufferDeg,
    north: maxLat + latBufferDeg,
    east: maxLng + lngBufferDeg,
  };
}
