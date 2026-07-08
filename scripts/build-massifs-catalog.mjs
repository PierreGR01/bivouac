// Reconstruit public/data/massifs-alpins.geojson à partir de contours orographiques
// réels issus d'OpenStreetMap (relations boundary=natural / region:type=mountain_area).
// Le zonage administratif BRA de Météo-France a été écarté entièrement (pas de fallback) :
// il est trop grossier pour un usage de tracé précis (ex. Belledonne coupait Montgilbert/
// Rochebrune, Beaufortain excluait le Mont Joly — vérifié par point-in-polygon) et une
// donnée imprécise présentée comme un raccourci fiable est pire qu'aucune donnée.
// Les massifs BRA sans relation OSM mountain_area équivalente (zones de vallée type
// Maurienne/Champsaur, ou régions sans couverture OSM comme la Corse et les Pyrénées) sont
// simplement absents du catalogue plutôt que représentés par une approximation.
//
// Sources brutes des relations OSM : dossier scratch fourni en entrée (fichiers
// "<clé>_osm.json", résultat de `relation(<id>);out geom;` sur overpass-api.de).
//
// Usage : node scripts/build-massifs-catalog.mjs <dossier_scratch_osm>

import fs from 'fs';
import path from 'path';

const scratchDir = process.argv[2];
if (!scratchDir) {
  console.error('Usage: node build-massifs-catalog.mjs <dossier_scratch_osm>');
  process.exit(1);
}

const OSM_MATCH = {
  Chablais: { file: 'chablais_osm.json', relation: 12656627, osmName: 'Massif du Chablais' },
  Aravis: { file: 'aravis_osm.json', relation: 19261748, osmName: 'Chaîne des Aravis' },
  'Mont-Blanc': { file: 'montblanc_osm.json', relation: 7465762, osmName: 'Massif du Mont-Blanc' },
  Bauges: { file: 'bauges_osm.json', relation: 7466521, osmName: 'Massif des Bauges' },
  Beaufortain: { file: 'beaufortain_osm.json', relation: 17929832, osmName: 'Massif du Beaufortain' },
  Chartreuse: { file: 'chartreuse_osm.json', relation: 7468871, osmName: 'Massif de la Chartreuse' },
  Belledonne: { file: 'belledonne_osm.json', relation: 7468786, osmName: 'Chaîne de Belledonne' },
  Vanoise: { file: 'vanoise_osm.json', relation: 7468709, osmName: 'Massif de la Vanoise' },
  'Grandes-Rousses': { file: 'grandesrousses_osm.json', relation: 16257269, osmName: 'Grandes Rousses' },
  Thabor: { file: 'cerces_osm.json', relation: 7468988, osmName: 'Massif des Cerces (secteur Thabor)' },
  Vercors: { file: 'vercors_osm.json', relation: 17930802, osmName: 'Massif du Vercors' },
  Pelvoux: { file: 'ecrins_osm.json', relation: 7469148, osmName: 'Massif des Écrins' },
  Queyras: { file: 'queyras_osm.json', relation: 19313657, osmName: 'Massif du Queyras' },
  Mercantour: { file: 'mercantour_osm.json', relation: 19317440, osmName: 'Massif du Mercantour-Argentera' },
};

// Massifs BRA sans équivalent orographique OSM net (zones de vallée, gap de couverture
// Corse/Pyrénées, ou risque de doublon avec un massif voisin déjà mappé) — exclus du
// catalogue plutôt que représentés par le contour Météo-France (trop grossier, cf. header).
const EXCLUDED_REASON = {
  'Haute-Tarentaise': 'zone de vallée, pas de massif orographique OSM dédié',
  Maurienne: 'zone de vallée, pas de massif orographique OSM dédié',
  'Haute-Maurienne': 'zone de vallée, pas de massif orographique OSM dédié',
  Oisans: "OSM ne distingue pas Oisans de Pelvoux (même massif des Écrins) — évite un doublon de tracé",
  Devoluy: 'aucune relation OSM mountain_area trouvée pour ce massif',
  Champsaur: 'zone de vallée, pas de massif orographique OSM dédié',
  'Embrunnais Parpaillon': "couverture OSM partielle (Parpaillon seul) — l'Embrunnais n'a pas d'équivalent",
  Ubaye: 'zone de vallée, pas de massif orographique OSM dédié',
  'Haut-Var Haut-Verdon': 'zone de vallée, pas de massif orographique OSM dédié',
  'Cinto Rotondo': 'aucune relation OSM mountain_area en Corse',
  'Renoso Incudine': 'aucune relation OSM mountain_area en Corse',
  'Pays-Basque': 'aucune relation OSM mountain_area dans les Pyrénées',
  'Aspe Ossau': 'aucune relation OSM mountain_area dans les Pyrénées',
  'Haute-Bigorre': 'aucune relation OSM mountain_area dans les Pyrénées',
  'Aure Louron': 'aucune relation OSM mountain_area dans les Pyrénées',
  Luchonnais: 'aucune relation OSM mountain_area dans les Pyrénées',
  Couserans: 'aucune relation OSM mountain_area dans les Pyrénées',
  'Haute-Ariege': 'aucune relation OSM mountain_area dans les Pyrénées',
  'Orlu St-Barthelemy': 'aucune relation OSM mountain_area dans les Pyrénées',
  'Capcir Puymorens': 'aucune relation OSM mountain_area dans les Pyrénées',
  'Cerdagne Canigou': 'aucune relation OSM mountain_area dans les Pyrénées',
};

function closeRing(ring) {
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (Math.abs(fx - lx) > 1e-9 || Math.abs(fy - ly) > 1e-9) ring.push([fx, fy]);
  return ring;
}

function assembleRings(osmJsonPath) {
  const data = JSON.parse(fs.readFileSync(osmJsonPath, 'utf8'));
  const rel = data.elements.find((e) => e.type === 'relation');
  const outerWays = (rel.members || []).filter(
    (m) => m.type === 'way' && (m.role === 'outer' || m.role === '' || !m.role)
  );
  const segments = outerWays.map((w) => (w.geometry || []).filter(Boolean).map((p) => [p.lon, p.lat]));
  const remaining = segments.filter((s) => s.length >= 2);
  const rings = [];
  const close = (a, b) => Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;

  while (remaining.length) {
    let cur = remaining.shift();
    let changed = true;
    while (changed) {
      changed = false;
      const first = cur[0];
      const last = cur[cur.length - 1];
      for (let i = 0; i < remaining.length; i++) {
        const seg = remaining[i];
        const sFirst = seg[0];
        const sLast = seg[seg.length - 1];
        if (close(last, sFirst)) {
          cur = cur.concat(seg.slice(1));
        } else if (close(last, sLast)) {
          cur = cur.concat(seg.slice().reverse().slice(1));
        } else if (close(first, sLast)) {
          cur = seg.slice(0, -1).concat(cur);
        } else if (close(first, sFirst)) {
          cur = seg.slice().reverse().slice(0, -1).concat(cur);
        } else {
          continue;
        }
        remaining.splice(i, 1);
        changed = true;
        break;
      }
    }
    rings.push(closeRing(cur));
  }
  return rings;
}

function ringArea(ring) {
  // Aire signée approximative (shoelace) — utilisée seulement pour trier les anneaux par
  // taille, pas pour une vraie superficie géodésique.
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum / 2);
}

const catalogPath = path.join('public', 'data', 'massifs-alpins.geojson');
const base = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const skipped = [];
const outFeatures = base.features.flatMap((feature) => {
  const title = feature.properties.title;
  const match = OSM_MATCH[title];

  if (!match) {
    skipped.push(`${title} — ${EXCLUDED_REASON[title] ?? 'non réévalué'}`);
    return [];
  }

  const osmPath = path.join(scratchDir, match.file);
  let rings = assembleRings(osmPath);
  if (!rings.length) {
    throw new Error(`Aucun anneau extrait pour ${title} depuis ${osmPath}`);
  }
  // Ne garder que les anneaux significatifs (> 0.0005 deg^2, écarte les résidus de
  // segments mal fermés / enclaves).
  rings = rings.filter((r) => ringArea(r) > 0.0005).sort((a, b) => ringArea(b) - ringArea(a));
  if (!rings.length) {
    throw new Error(`Tous les anneaux de ${title} ont été filtrés comme trop petits`);
  }

  return [{
    ...feature,
    geometry: {
      type: 'MultiPolygon',
      coordinates: rings.map((ring) => [ring]),
    },
    properties: {
      ...feature.properties,
      source: 'osm',
      source_note: `Contour orographique OpenStreetMap : relation ${match.relation} (${match.osmName})`,
    },
  }];
});

const out = {
  type: 'FeatureCollection',
  name: base.name,
  features: outFeatures,
};

fs.writeFileSync(catalogPath, JSON.stringify(out));

console.log(`OK — ${outFeatures.length} massifs retenus (contour OSM uniquement).`);
console.log(`Exclus du catalogue (pas de contour OSM fiable) : ${skipped.length}`);
skipped.forEach((s) => console.log(`  - ${s}`));
