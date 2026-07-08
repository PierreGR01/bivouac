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

// Coordonnées, altitudes et identifiants DPObs validés via l'endpoint officiel
// Météo-France /liste-stations (public-api.meteofrance.fr, DPObs v2) — juillet 2026.
// Exception : "beaufortain-parets" n'a pas de correspondance dans la liste
// officielle des stations Nivose et reste donc une approximation non vérifiée.
export const NIVOSES: NivoseStation[] = [
  // ── Alpes du Nord — Chartreuse / Vercors / Belledonne ──────────────────
  { id: 'col-de-porte',      name: 'Col de Porte',                    lat: 45.295000, lon: 5.765333, altitude: 1325, region: 'Chartreuse',          meteofCode: 'COLPOS', meteofId: '38472403' },
  { id: 'col-aigleton',      name: "Col de l'Aigleton",               lat: 45.231000, lon: 6.038167, altitude: 2240, region: 'Belledonne',           meteofCode: 'AIGLES', meteofId: '38005402' },
  { id: 'saint-hilaire',     name: 'Saint-Hilaire-du-Touvet',         lat: 45.313833, lon: 5.863500, altitude: 1756, region: 'Chartreuse',          meteofCode: 'STHILS', meteofId: '38395403' },
  { id: 'vercors-pas-oeille',name: "Vercors — Pas de l'Oeille",       lat: 45.015000, lon: 5.588667, altitude: 1646, region: 'Vercors',              meteofCode: 'LEGUAS', meteofId: '38187400' },
  // ── Alpes du Nord — Bauges / Beaufortain ───────────────────────────────
  { id: 'bauges-allans',     name: 'Bauges — Plan de la Limace',       lat: 45.663833, lon: 6.211833, altitude: 1684, region: 'Bauges',               meteofCode: 'ALLANS', meteofId: '73139401' },
  { id: 'beaufortain-parets',name: 'Beaufortain — Parets',             lat: 45.740, lon: 6.617, altitude: 1900, region: 'Beaufortain',          meteofCode: 'PAREIS' },
  // ── Alpes du Nord — Maurienne / Oisans ─────────────────────────────────
  { id: 'col-galibier',      name: 'Col du Galibier',                  lat: 45.056833, lon: 6.377167, altitude: 2559, region: 'Maurienne / Oisans',   meteofCode: 'GALIBS', meteofId: '05079402' },
  { id: 'rochilles',         name: 'Rochilles (Plan Lachat)',           lat: 45.085000, lon: 6.469000, altitude: 2444, region: 'Maurienne',            meteofCode: 'ROCHIS', meteofId: '73306401' },
  { id: 'meije',             name: 'Meije',                            lat: 45.012333, lon: 6.265167, altitude: 3093, region: 'Oisans',               meteofCode: 'MEIJES', meteofId: '05063402' },
  { id: 'ecrins',            name: 'Écrins — Glacier de Bonnepierre',  lat: 44.936833, lon: 6.346167, altitude: 2970, region: 'Écrins',               meteofCode: 'ECRINS', meteofId: '38375402' },
  { id: 'col-lac-blanc',     name: 'Aiguilles Rouges — Lac Blanc',     lat: 45.986333, lon: 6.896833, altitude: 2365, region: 'Mont-Blanc',           meteofCode: 'AIGRGS', meteofId: '74056405' },
  // ── Alpes du Nord — Tarentaise / Haute-Maurienne ───────────────────────
  { id: 'bellecote',         name: 'Bellecôte',                        lat: 45.489000, lon: 6.771167, altitude: 2992, region: 'Tarentaise',           meteofCode: 'BELLES', meteofId: '73071403' },
  { id: 'tignes',            name: 'Tignes-Chevril',                   lat: 45.499667, lon: 6.955333, altitude: 2559, region: 'Tarentaise',           meteofCode: 'CHEVRS', meteofId: '73296406' },
  { id: 'bonneval-arc',      name: 'Bonneval-sur-Arc',                 lat: 45.351667, lon: 7.051167, altitude: 2741, region: 'Haute-Maurienne',      meteofCode: 'BONNES', meteofId: '73040402' },
  // ── Alpes du Sud ───────────────────────────────────────────────────────
  { id: 'parpaillon',        name: 'Embrunais — Col du Parpaillon',    lat: 44.495333, lon: 6.636333, altitude: 2545, region: 'Embrunais-Parpaillon',  meteofCode: 'PARPAS', meteofId: '05044400' },
  { id: 'orcieres-merlette', name: 'Orcières-Merlette',                lat: 44.719000, lon: 6.333667, altitude: 2280, region: 'Champsaur-Dévoluy',    meteofCode: 'ORCIES', meteofId: '05096404' },
  { id: 'col-agnel',         name: 'Col Agnel',                        lat: 44.688667, lon: 6.976167, altitude: 2627, region: 'Queyras',               meteofCode: 'AGNELS', meteofId: '05077402' },
  { id: 'restefond',         name: 'Ubaye — Col du Restefond',         lat: 44.340000, lon: 6.800000, altitude: 2550, region: 'Ubaye',                 meteofCode: 'RESTES', meteofId: '04096401' },
  { id: 'tinee-vesubie',     name: 'Tinée / Vésubie — Millefont',      lat: 44.118333, lon: 7.192000, altitude: 2430, region: 'Mercantour',            meteofCode: 'MILLES', meteofId: '06153400' },
];
