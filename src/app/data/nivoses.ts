export interface NivoseStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  altitude: number;
  region: string;
  /** Code station Météo-France pour le GIF temps-réel :
   *  https://rwg.meteofrance.com/internet2018client/2.0/files/mountain/observations/{meteofCode}.gif */
  meteofCode?: string;
  /** Identifiant numérique Météo-France (DPObs API) — ex: "38395403"
   *  Nécessite une clé API gratuite : https://portail-api.meteofrance.fr/ */
  meteofId?: string;
}

// Seules les stations avec meteofCode sont conservées — leur existence est confirmée
// par les GIFs Météo-France (rwg.meteofrance.com). Les coordonnées restent à valider
// via l'API DPObs une fois la clé disponible.
export const NIVOSES: NivoseStation[] = [
  // ── Alpes du Nord — Chartreuse / Vercors / Belledonne ──────────────────
  { id: 'col-de-porte',      name: 'Col de Porte',                    lat: 45.296, lon: 5.763, altitude: 1325, region: 'Chartreuse',          meteofCode: 'COLPOS' },
  { id: 'col-aigleton',      name: "Col de l'Aigleton",               lat: 45.191, lon: 5.952, altitude: 2090, region: 'Belledonne',           meteofCode: 'AIGLES' },
  { id: 'saint-hilaire',     name: 'Saint-Hilaire-du-Touvet',         lat: 45.296, lon: 5.872, altitude: 1756, region: 'Chartreuse',           meteofCode: 'STHILS', meteofId: '38395403' },
  { id: 'vercors-pas-oeille',name: "Vercors — Pas de l'Oeille",       lat: 44.942, lon: 5.610, altitude: 1664, region: 'Vercors',              meteofCode: 'LEGUAS' },
  // ── Alpes du Nord — Bauges / Beaufortain ───────────────────────────────
  { id: 'bauges-allans',     name: 'Bauges — Plan de la Limace',       lat: 45.568, lon: 6.183, altitude: 1710, region: 'Bauges',               meteofCode: 'ALLANS' },
  { id: 'beaufortain-parets',name: 'Beaufortain — Parets',             lat: 45.740, lon: 6.617, altitude: 1900, region: 'Beaufortain',          meteofCode: 'PAREIS' },
  // ── Alpes du Nord — Maurienne / Oisans ─────────────────────────────────
  { id: 'col-galibier',      name: 'Col du Galibier',                  lat: 45.064, lon: 6.407, altitude: 2642, region: 'Maurienne / Oisans',   meteofCode: 'GALIBS' },
  { id: 'rochilles',         name: 'Rochilles (Plan Lachat)',           lat: 45.012, lon: 6.546, altitude: 2460, region: 'Maurienne',            meteofCode: 'ROCHIS' },
  { id: 'meije',             name: 'Meije',                            lat: 45.017, lon: 6.441, altitude: 2400, region: 'Oisans',               meteofCode: 'MEIJES' },
  { id: 'ecrins',            name: 'Écrins — Glacier de Bonnepierre',  lat: 44.941, lon: 6.347, altitude: 2480, region: 'Écrins',               meteofCode: 'ECRINS' },
  { id: 'col-lac-blanc',     name: 'Aiguilles Rouges — Lac Blanc',     lat: 45.954, lon: 6.874, altitude: 2352, region: 'Mont-Blanc',           meteofCode: 'AIGRGS' },
  // ── Alpes du Nord — Tarentaise / Haute-Maurienne ───────────────────────
  { id: 'bellecote',         name: 'Bellecôte',                        lat: 45.498, lon: 6.666, altitude: 2487, region: 'Tarentaise',           meteofCode: 'BELLES' },
  { id: 'tignes',            name: 'Tignes-Chevril',                   lat: 45.452, lon: 6.905, altitude: 1550, region: 'Tarentaise',           meteofCode: 'CHEVRS' },
  { id: 'bonneval-arc',      name: 'Bonneval-sur-Arc',                 lat: 45.363, lon: 7.046, altitude: 1800, region: 'Haute-Maurienne',      meteofCode: 'BONNES' },
  // ── Alpes du Sud ───────────────────────────────────────────────────────
  { id: 'parpaillon',        name: 'Embrunais — Col du Parpaillon',    lat: 44.504, lon: 6.583, altitude: 2637, region: 'Embrunais-Parpaillon',  meteofCode: 'PARPAS' },
  { id: 'orcieres-merlette', name: 'Orcières-Merlette',                lat: 44.726, lon: 6.322, altitude: 1838, region: 'Champsaur-Dévoluy',    meteofCode: 'ORCIES' },
  { id: 'col-agnel',         name: 'Col Agnel',                        lat: 44.684, lon: 6.983, altitude: 2744, region: 'Queyras',               meteofCode: 'AGNELS' },
  { id: 'restefond',         name: 'Ubaye — Col du Restefond',         lat: 44.327, lon: 6.820, altitude: 2802, region: 'Ubaye',                 meteofCode: 'RESTES' },
  { id: 'tinee-vesubie',     name: 'Tinée / Vésubie — Millefont',      lat: 44.115, lon: 7.285, altitude: 2350, region: 'Mercantour',            meteofCode: 'MILLES' },
];
