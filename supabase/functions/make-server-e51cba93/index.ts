import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";

// Gestionnaire global pour les erreurs non capturées de Deno
globalThis.addEventListener("error", (event) => {
  const error = event.error;
  if (
    error?.code === 'EPIPE' ||
    error?.name === 'Http' ||
    error?.message?.includes('connection closed') ||
    error?.message?.includes('broken pipe')
  ) {
    event.preventDefault();
    return;
  }
});

globalThis.addEventListener("unhandledrejection", (event) => {
  const error = event.reason;
  if (
    error?.code === 'EPIPE' ||
    error?.name === 'Http' ||
    error?.message?.includes('connection closed') ||
    error?.message?.includes('broken pipe')
  ) {
    event.preventDefault();
    return;
  }
});

const app = new Hono();

const safeHandler = (handler: any) => async (c: any) => {
  try {
    return await handler(c);
  } catch (error: any) {
    if (
      error?.code === 'EPIPE' ||
      error?.name === 'Http' ||
      error?.message?.includes('connection closed') ||
      error?.message?.includes('broken pipe')
    ) {
      console.log('ℹ️ Client a fermé la connexion (ignoré)');
      return new Response(null, { status: 499 });
    }
    console.error('❌ Erreur serveur:', error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
};

// --- Security helpers ---

function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// Verify the bearer token as a real user session (anon key has role:"anon", not "authenticated")
async function getAuthedUser(c: any): Promise<{ id: string } | null> {
  const authHeader = c.req.header("Authorization") as string | undefined;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return { id: user.id };
}

async function isSuperAdmin(userId: string): Promise<boolean> {
  const { data } = await getServiceClient()
    .from("admin_users")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

async function requireAdmin(c: any): Promise<boolean> {
  const user = await getAuthedUser(c);
  if (!user) return false;
  return isSuperAdmin(user.id);
}

async function isAnyAdmin(userId: string): Promise<boolean> {
  if (await isSuperAdmin(userId)) return true;
  const { data } = await getServiceClient()
    .from("zone_admins")
    .select("id")
    .eq("user_id", userId)
    .limit(1);
  return !!data && data.length > 0;
}

// Super-admin or zone-admin (dashboard access) — not scoped to a specific POI/zone.
async function requireAnyAdmin(c: any): Promise<boolean> {
  const user = await getAuthedUser(c);
  if (!user) return false;
  return isAnyAdmin(user.id);
}

// --- Zone-admin scoped POI moderation ---

function isPointInGeoJSONRing(point: { lat: number; lng: number }, ring: number[][]): boolean {
  const n = ring.length;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = ((yi > point.lat) !== (yj > point.lat))
      && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointInZoneGeometry(point: { lat: number; lng: number }, geometry: any): boolean {
  if (!geometry) return false;
  const raw = geometry as Record<string, unknown>;
  let geom: any = null;
  if (raw.type === "Feature") {
    geom = (raw as any).geometry;
  } else if (raw.type === "Polygon" || raw.type === "MultiPolygon") {
    geom = raw;
  }
  if (!geom) return false;

  if (geom.type === "Polygon") {
    return isPointInGeoJSONRing(point, geom.coordinates[0]);
  }
  if (geom.type === "MultiPolygon") {
    return geom.coordinates.some((poly: number[][][]) => isPointInGeoJSONRing(point, poly[0]));
  }
  return false;
}

// Géométries des territoires (admin_zones) administrés par un utilisateur — factorisé pour
// être réutilisé à la fois par canModeratePoi (une seule position) et par le filtrage de
// visibilité de GET /pois (toute la liste, une seule requête au lieu d'un aller-retour par POI).
async function getModeratorZoneGeometries(userId: string): Promise<any[]> {
  const adminClient = getServiceClient();
  const { data: grants } = await adminClient
    .from("zone_admins")
    .select("admin_zone_id")
    .eq("user_id", userId);
  const zoneIds = (grants ?? []).map((g: any) => g.admin_zone_id);
  if (zoneIds.length === 0) return [];

  const { data: zones } = await adminClient
    .from("admin_zones")
    .select("geometry")
    .in("id", zoneIds);
  return zones ?? [];
}

// Super-admin can moderate any POI; a zone-admin can moderate any POI located
// inside one of the administration territories (admin_zones) assigned to them —
// not just POIs inside a specific regulated zone.
async function canModeratePoi(c: any, poiPosition: { lat: number; lng: number } | undefined): Promise<boolean> {
  const user = await getAuthedUser(c);
  if (!user) return false;
  if (await isSuperAdmin(user.id)) return true;
  if (!poiPosition || typeof poiPosition.lat !== "number" || typeof poiPosition.lng !== "number") return false;

  const zones = await getModeratorZoneGeometries(user.id);
  return zones.some((z: any) => isPointInZoneGeometry(poiPosition, z.geometry));
}

interface ModerationContext {
  isSuper: boolean;
  userId: string | null;
  zones: any[];
}

// Contexte de modération résolu une seule fois pour filtrer une liste entière de POIs
// (GET /pois), plutôt qu'un appel canModeratePoi par POI.
async function getModerationContext(c: any): Promise<ModerationContext> {
  const user = await getAuthedUser(c);
  if (!user) return { isSuper: false, userId: null, zones: [] };
  if (await isSuperAdmin(user.id)) return { isSuper: true, userId: user.id, zones: [] };
  const zones = await getModeratorZoneGeometries(user.id);
  return { isSuper: false, userId: user.id, zones };
}

function canSeePrivatePoi(poi: any, ctx: ModerationContext): boolean {
  if (ctx.isSuper) return true;
  if (ctx.userId && poi.createdBy === ctx.userId) return true;
  return ctx.zones.some((z: any) => isPointInZoneGeometry(poi.position, z.geometry));
}

// --- Zone optionnelle d'un spot (≤ MAX_POI_ZONE_AREA_M2, doit contenir le point) ---
// Miroir de src/app/utils/poi-zone.ts — dupliqué ici pour que la contrainte ne soit pas
// contournable par une requête forgée directement contre l'edge function.

const MAX_POI_ZONE_AREA_M2 = 2000;
const METERS_PER_DEGREE_LAT = 111_320;

// Miroir de MAX_PHOTOS_PER_SPOT dans AddPoiPanel.tsx — même raison que MAX_POI_ZONE_AREA_M2 :
// une requête forgée directement contre l'Edge Function ne doit pas pouvoir contourner la
// limite appliquée côté client.
const MAX_PHOTOS_PER_SPOT = 4;

// Un spot ne doit jamais stocker une photo en base64 inline (c'était l'ancien fonctionnement,
// remplacé par un upload vers le bucket Storage `spot-photos` — voir POST /photos/upload) :
// ça fait gonfler `spots.detail` et chaque fetch de la liste. Le flux normal ne produit plus
// jamais de data URI, mais rien n'empêchait une requête forgée (ou le champ "URL de la photo"
// côté client) d'en soumettre une directement.
function hasDataUriPhoto(photos: unknown): boolean {
  if (!Array.isArray(photos)) return false;
  return photos.some((p: any) => {
    const url = typeof p === "string" ? p : p?.url;
    return typeof url === "string" && url.startsWith("data:");
  });
}

// Bornes anti-abus sur les champs texte libres d'un spot (aucune limite client existante
// à reprendre ; valeurs de départ raisonnables, ajustables si besoin).
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 3000;
const MAX_REGULATIONS_LENGTH = 3000;

function validateTextFieldLengths(fields: Record<string, unknown>): string | null {
  if (typeof fields.title === "string" && fields.title.length > MAX_TITLE_LENGTH) {
    return `Le titre ne doit pas dépasser ${MAX_TITLE_LENGTH} caractères`;
  }
  if (typeof fields.description === "string" && fields.description.length > MAX_DESCRIPTION_LENGTH) {
    return `La description ne doit pas dépasser ${MAX_DESCRIPTION_LENGTH} caractères`;
  }
  if (typeof fields.regulations === "string" && fields.regulations.length > MAX_REGULATIONS_LENGTH) {
    return `Le champ réglementation ne doit pas dépasser ${MAX_REGULATIONS_LENGTH} caractères`;
  }
  return null;
}

function poiZoneRing(geometry: any): number[][] | null {
  if (!geometry) return null;
  const geom = geometry.type === "Feature" ? geometry.geometry : geometry;
  if (!geom) return null;
  if (geom.type === "Polygon") return geom.coordinates[0] ?? null;
  if (geom.type === "MultiPolygon") return geom.coordinates[0]?.[0] ?? null;
  return null;
}

function computePoiZoneAreaM2(geometry: any): number {
  const ring = poiZoneRing(geometry);
  if (!ring || ring.length < 3) return 0;
  const avgLatRad = (ring.reduce((sum: number, p: number[]) => sum + p[1], 0) / ring.length) * (Math.PI / 180);
  const metersPerDegreeLng = METERS_PER_DEGREE_LAT * Math.cos(avgLatRad);
  const projected = ring.map(([lng, lat]: number[]) => [lng * metersPerDegreeLng, lat * METERS_PER_DEGREE_LAT]);
  let area = 0;
  for (let i = 0; i < projected.length; i++) {
    const [x1, y1] = projected[i];
    const [x2, y2] = projected[(i + 1) % projected.length];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

function isValidPoiZone(position: { lat: number; lng: number } | undefined, geometry: any): boolean {
  if (!geometry) return true;
  if (!position || typeof position.lat !== "number" || typeof position.lng !== "number") return false;
  if (!isPointInZoneGeometry(position, geometry)) return false;
  return computePoiZoneAreaM2(geometry) <= MAX_POI_ZONE_AREA_M2;
}

function validateBounds(body: any): { south: number; west: number; north: number; east: number } {
  const clamp = (v: unknown, min: number, max: number, name: string): number => {
    const n = Number(v);
    if (!isFinite(n) || n < min || n > max) throw new Error(`Invalid ${name}: ${v}`);
    return n;
  };
  return {
    south: clamp(body.south, -90, 90, "south"),
    west:  clamp(body.west,  -180, 180, "west"),
    north: clamp(body.north, -90, 90, "north"),
    east:  clamp(body.east,  -180, 180, "east"),
  };
}

function validateTimeout(val: unknown, maxSec = 60): number {
  const n = Math.floor(Number(val));
  return isFinite(n) && n >= 5 && n <= maxSec ? n : 30;
}

// Persistent sliding-window rate limiter backed by the `rate_limits` table (see migration
// 20260724150001_create_rate_limits.sql). Atomic upsert via RPC — survives cold starts and
// horizontal scaling, unlike a per-instance in-memory Map.
async function checkRateLimit(key: string, maxPerWindow: number, windowSec = 3600): Promise<boolean> {
  const { data, error } = await getServiceClient().rpc("check_and_increment_rate_limit", {
    p_key: key,
    p_max: maxPerWindow,
    p_window_seconds: windowSec,
  });
  if (error) {
    console.error("Rate limit check failed (failing open):", error);
    return true;
  }
  return !!data;
}

// The Edge Function's own reverse proxy appends the real client IP as the LAST hop of
// X-Forwarded-For; any earlier hop (including the first, which a client request arrives
// with by default) can be forged by the caller. Prefer `x-real-ip` when present (set by
// the platform, not appendable by the client).
function getClientIp(c: any): string {
  const realIp = c.req.header("x-real-ip");
  if (realIp) return realIp.trim();
  const xff = c.req.header("x-forwarded-for");
  if (!xff) return "unknown";
  const hops = xff.split(",").map((h: string) => h.trim()).filter(Boolean);
  return hops[hops.length - 1] ?? "unknown";
}

// --- CORS ---
// ALLOWED_ORIGIN secret restricts cross-origin calls to the production app's origin.
// DENO_DEPLOYMENT_ID is only set when running on Supabase's deployed infrastructure, so a
// truly local Edge Function (`supabase functions serve`) still falls back to "*" for
// convenience. In practice though, the frontend's local dev server (`npm run dev`) also
// calls the *deployed* function (see VITE_EDGE_FUNCTION_URL in .env.local), not a local
// one — so DENO_DEPLOYMENT_ID is set even for local frontend development, and the plain
// "*" fallback above never applies to it. We therefore also allow any localhost/127.0.0.1
// origin explicitly. CORS only gates what a browser's JS is allowed to read; it isn't a
// security boundary against non-browser callers, so this doesn't weaken the lockdown
// against untrusted browser origins hitting the production app.
const PROD_ORIGIN = "https://bivouac-proto.vercel.app";
const isLocalDev = !Deno.env.get("DENO_DEPLOYMENT_ID");
const configuredOrigin = Deno.env.get("ALLOWED_ORIGIN") || PROD_ORIGIN;
const isLocalOrigin = (origin: string) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
app.use(
  "/*",
  cors({
    origin: isLocalDev
      ? "*"
      : (origin: string) => (origin === configuredOrigin || isLocalOrigin(origin) ? origin : null),
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check
app.get("/make-server-e51cba93/health", safeHandler((c: any) => {
  return c.json({ status: "ok" });
}));

// --- Stockage des POIs — table `spots` (indexée) comme source de vérité, avec
// double-écriture vers kv_store (legacy) en filet de sécurité pendant la transition.
// La forme de l'objet "poi" retournée par ces helpers est identique à celle qui
// était stockée dans kv_store, pour ne rien changer à la logique des routes.

function poiToRow(poi: any) {
  const {
    id, position, title, season, isPublic, disabledUntil,
    createdBy, createdAt, altitude, capacity, difficulty,
    waterProximity, naturalWaterProximity, ...rest
  } = poi;
  return {
    id,
    lat: position?.lat,
    lng: position?.lng,
    title: title ?? "",
    season: season ?? "toute-annee",
    is_public: isPublic !== false,
    disabled_until: disabledUntil ?? null,
    created_by: createdBy ?? null,
    created_at: createdAt ?? new Date().toISOString(),
    altitude: altitude ?? null,
    capacity: capacity ?? null,
    difficulty: difficulty ?? null,
    water_proximity: waterProximity ?? null,
    natural_water_proximity: naturalWaterProximity ?? null,
    photos_count: Array.isArray(rest.photos) ? rest.photos.length : 0,
    detail: rest,
  };
}

function rowToPoi(row: any): any {
  return {
    id: row.id,
    position: { lat: row.lat, lng: row.lng },
    title: row.title,
    season: row.season,
    isPublic: row.is_public,
    disabledUntil: row.disabled_until,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    altitude: row.altitude ?? undefined,
    capacity: row.capacity ?? undefined,
    difficulty: row.difficulty ?? undefined,
    waterProximity: row.water_proximity ?? null,
    naturalWaterProximity: row.natural_water_proximity ?? undefined,
    ...row.detail,
  };
}

async function getAllPois(): Promise<any[]> {
  const { data, error } = await getServiceClient().from("spots").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToPoi);
}

// Version allégée pour les listings admin (potentiellement des milliers de lignes à
// l'échelle d'un territoire ou de toute la plateforme) — ne sélectionne aucun champ
// lourd (`detail`, donc pas de photos/reviews/description/regulations/zoneGeometry).
interface PoiSummary {
  id: string;
  position: { lat: number; lng: number };
  title: string;
  isPublic: boolean;
  disabledUntil: string | null;
  createdBy: string | null;
  createdAt: string;
  photosCount: number;
}

async function getPoiSummaries(): Promise<PoiSummary[]> {
  const { data, error } = await getServiceClient()
    .from("spots")
    .select("id, lat, lng, title, is_public, disabled_until, created_by, created_at, photos_count");
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    position: { lat: row.lat, lng: row.lng },
    title: row.title,
    isPublic: row.is_public,
    disabledUntil: row.disabled_until,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    photosCount: row.photos_count ?? 0,
  }));
}

// Version allégée pour le listing PUBLIC (carte, dashboard utilisateur) — mêmes champs
// typés que PoiSummary, mais garde `season`/`altitude`/`capacity`/`difficulty`/
// `waterProximity`/`naturalWaterProximity` que la carte et les filtres utilisent
// directement sur chaque item de la liste (contrairement aux champs vraiment lourds :
// photos, reviews, description, regulations, zoneGeometry — jamais renvoyés ici).
function rowToPoiListItem(row: any): any {
  return {
    id: row.id,
    position: { lat: row.lat, lng: row.lng },
    title: row.title,
    season: row.season,
    isPublic: row.is_public,
    disabledUntil: row.disabled_until,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    altitude: row.altitude ?? undefined,
    capacity: row.capacity ?? undefined,
    difficulty: row.difficulty ?? undefined,
    waterProximity: row.water_proximity ?? null,
    naturalWaterProximity: row.natural_water_proximity ?? undefined,
    photosCount: row.photos_count ?? 0,
  };
}

interface Bbox { south: number; west: number; north: number; east: number; }

async function getAllPoiListItems(bbox?: Bbox): Promise<any[]> {
  let query = getServiceClient()
    .from("spots")
    .select("id, lat, lng, title, season, is_public, disabled_until, created_by, created_at, altitude, capacity, difficulty, water_proximity, natural_water_proximity, photos_count");
  if (bbox) {
    query = query.gte("lat", bbox.south).lte("lat", bbox.north).gte("lng", bbox.west).lte("lng", bbox.east);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToPoiListItem);
}

function encodePoiCursor(p: PoiSummary): string {
  return btoa(JSON.stringify({ createdAt: p.createdAt, id: p.id }));
}

function decodePoiCursor(raw: string): { createdAt: string; id: string } | null {
  try {
    const parsed = JSON.parse(atob(raw));
    if (typeof parsed?.createdAt === "string" && typeof parsed?.id === "string") return parsed;
    return null;
  } catch {
    return null;
  }
}

async function getPoi(id: string): Promise<any | null> {
  const { data, error } = await getServiceClient().from("spots").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToPoi(data) : null;
}

async function setPoi(poi: any): Promise<void> {
  const { error } = await getServiceClient().from("spots").upsert(poiToRow(poi), { onConflict: "id" });
  if (error) throw new Error(error.message);
  await kv.set(`poi:${poi.id}`, poi);
}

async function deletePoi(id: string): Promise<void> {
  const { error } = await getServiceClient().from("spots").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await kv.del(`poi:${id}`);
}

async function deletePoisBulk(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await getServiceClient().from("spots").delete().in("id", ids);
  if (error) throw new Error(error.message);
  await kv.mdel(...ids.map((id) => `poi:${id}`));
}

function parseBboxQuery(c: any): Bbox | undefined {
  const south = Number(c.req.query("south"));
  const west = Number(c.req.query("west"));
  const north = Number(c.req.query("north"));
  const east = Number(c.req.query("east"));
  const valid = [south, west, north, east].every((n) => isFinite(n))
    && south >= -90 && north <= 90 && south <= north
    && west >= -180 && east <= 180 && west <= east;
  return valid ? { south, west, north, east } : undefined;
}

// Get all POIs — public read, filtered by visibility (spots marked private are only
// returned to their owner and to admins/territory-admins who can moderate them).
// Bbox optionnel (south/west/north/east) — utilisé par la carte pour ne charger que les
// spots de la zone affichée ; absent = comportement historique (tout renvoyer), gardé
// pour ne pas casser un appelant qui n'enverrait pas ces paramètres.
app.get("/make-server-e51cba93/pois", safeHandler(async (c: any) => {
  try {
    const bbox = parseBboxQuery(c);
    const pois = await getAllPoiListItems(bbox);
    const ctx = await getModerationContext(c);
    const visible = ctx.isSuper
      ? pois
      : pois.filter((p: any) => p.isPublic !== false || canSeePrivatePoi(p, ctx));
    return c.json({ success: true, data: visible });
  } catch (error) {
    console.error("Error fetching POIs:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Liste paginée pour le tableau de bord admin — super-admin (toute la plateforme) ou
// admin de zone (son/ses territoire(s) uniquement). Volontairement distincte de
// GET /pois : ne renvoie jamais de champs lourds (photos/reviews/description/...),
// seulement un `photosCount` calculé côté serveur, et pagine par curseur (createdAt, id)
// pour rester performant quel que soit le nombre de spots.
app.get("/make-server-e51cba93/pois/admin-list", safeHandler(async (c: any) => {
  if (!(await requireAnyAdmin(c))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const ctx = await getModerationContext(c);
    let summaries = await getPoiSummaries();
    if (!ctx.isSuper) {
      summaries = summaries.filter((p) => ctx.zones.some((z: any) => isPointInZoneGeometry(p.position, z.geometry)));
    }

    summaries.sort((a, b) => {
      const byDate = b.createdAt.localeCompare(a.createdAt);
      return byDate !== 0 ? byDate : b.id.localeCompare(a.id);
    });

    const limit = Math.min(Math.max(parseInt(c.req.query("limit") ?? "50", 10) || 50, 1), 200);
    const cursorParam = c.req.query("cursor");
    let startIndex = 0;
    if (cursorParam) {
      const decoded = decodePoiCursor(cursorParam);
      if (decoded) {
        const idx = summaries.findIndex((p) => p.createdAt === decoded.createdAt && p.id === decoded.id);
        startIndex = idx >= 0 ? idx + 1 : 0;
      }
    }

    const page = summaries.slice(startIndex, startIndex + limit);
    const nextCursor = (startIndex + limit) < summaries.length ? encodePoiCursor(page[page.length - 1]) : null;

    return c.json({ success: true, data: page, nextCursor, total: summaries.length });
  } catch (error) {
    console.error("Error fetching admin POI list:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Avis postés par l'utilisateur courant, à travers TOUS les spots (pas seulement les
// siens) — utilisé par l'onglet "Mes avis" du dashboard utilisateur. GET /pois étant
// désormais allégé (pas de champ `reviews`), ce scan doit se faire côté serveur ;
// la réponse elle-même reste petite (bornée par le nombre d'avis de CET utilisateur,
// pas par le nombre total de spots de la plateforme).
app.get("/make-server-e51cba93/pois/my-reviews", safeHandler(async (c: any) => {
  const user = await getAuthedUser(c);
  if (!user) {
    return c.json({ success: false, error: "Connexion requise" }, 401);
  }
  try {
    const pois = await getAllPois();
    const myReviews = pois.flatMap((poi: any) => {
      const reviews: any[] = poi.reviews || [];
      return reviews
        .map((review: any, idx: number) => ({ review, idx }))
        .filter(({ review }: any) => review?.userId === user.id)
        .map(({ review, idx }: any) => ({
          review,
          reviewKey: review.createdAt ?? `__idx_${idx}__`,
          poiId: poi.id,
          poiTitle: poi.title,
          poiPosition: poi.position,
        }));
    });
    return c.json({ success: true, data: myReviews });
  } catch (error) {
    console.error("Error fetching user's reviews:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Spots créés par l'utilisateur courant — utilisé par l'onglet "Mes spots" du dashboard.
// GET /pois étant désormais scopé à la zone visible de la carte (Phase 4), ce listing ne
// peut plus en dépendre : un spot créé par l'utilisateur mais hors du viewport actuel
// doit rester visible dans son propre dashboard. Bornée par le nombre de spots CE
// compte a créé, pas par le volume total de la plateforme.
app.get("/make-server-e51cba93/pois/mine", safeHandler(async (c: any) => {
  const user = await getAuthedUser(c);
  if (!user) {
    return c.json({ success: false, error: "Connexion requise" }, 401);
  }
  try {
    const { data, error } = await getServiceClient()
      .from("spots")
      .select("id, lat, lng, title, season, is_public, disabled_until, created_by, created_at, altitude, capacity, difficulty, water_proximity, natural_water_proximity, photos_count")
      .eq("created_by", user.id);
    if (error) throw new Error(error.message);
    return c.json({ success: true, data: (data ?? []).map(rowToPoiListItem) });
  } catch (error) {
    console.error("Error fetching user's own POIs:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Résout un ensemble d'ids de spots (ex: favoris) en items légers, indépendamment de la
// zone visible de la carte — un favori hors du viewport courant doit rester résolvable.
// Filtré par la même règle de visibilité que la liste principale.
app.get("/make-server-e51cba93/pois/by-ids", safeHandler(async (c: any) => {
  try {
    const raw = c.req.query("ids") ?? "";
    const ids = [...new Set(raw.split(",").map((s: string) => s.trim()).filter(Boolean))].slice(0, 300);
    if (ids.length === 0) {
      return c.json({ success: true, data: [] });
    }

    const { data, error } = await getServiceClient()
      .from("spots")
      .select("id, lat, lng, title, season, is_public, disabled_until, created_by, created_at, altitude, capacity, difficulty, water_proximity, natural_water_proximity, photos_count")
      .in("id", ids as string[]);
    if (error) throw new Error(error.message);

    const items = (data ?? []).map(rowToPoiListItem);
    const ctx = await getModerationContext(c);
    const visible = ctx.isSuper
      ? items
      : items.filter((p: any) => p.isPublic !== false || canSeePrivatePoi(p, ctx));
    return c.json({ success: true, data: visible });
  } catch (error) {
    console.error("Error fetching POIs by ids:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Create a new POI — requires a logged-in user, rate-limited
app.post("/make-server-e51cba93/pois", safeHandler(async (c: any) => {
  const user = await getAuthedUser(c);
  if (!user) {
    return c.json({ success: false, error: "Connexion requise pour créer un spot" }, 401);
  }

  const ip = getClientIp(c);
  if (!(await checkRateLimit(`create:${ip}`, 20))) {
    return c.json({ success: false, error: "Too many requests" }, 429);
  }

  try {
    const body = await c.req.json();
    const { id, title, description, photos, season, waterProximity, naturalWaterProximity, regulations, position, altitude, capacity, difficulty, zoneGeometry, isPublic } = body;

    if (!id || !title || !position) {
      return c.json({ success: false, error: "Missing required fields: id, title, position" }, 400);
    }

    const lengthError = validateTextFieldLengths({ title, description, regulations });
    if (lengthError) {
      return c.json({ success: false, error: lengthError }, 400);
    }

    if (zoneGeometry && !isValidPoiZone(position, zoneGeometry)) {
      return c.json({ success: false, error: `Zone invalide : elle doit contenir le point du spot et ne pas dépasser ${MAX_POI_ZONE_AREA_M2} m²` }, 400);
    }

    if (Array.isArray(photos) && photos.length > MAX_PHOTOS_PER_SPOT) {
      return c.json({ success: false, error: `Maximum ${MAX_PHOTOS_PER_SPOT} photos par spot` }, 400);
    }
    if (hasDataUriPhoto(photos)) {
      return c.json({ success: false, error: "Les photos doivent être uploadées via /photos/upload, pas fournies en base64" }, 400);
    }

    const poi = {
      id,
      title,
      description,
      photos,
      season,
      waterProximity,
      naturalWaterProximity,
      regulations,
      position,
      altitude,
      capacity,
      difficulty,
      // `ratings` n'est jamais fourni par le client (cf. src/app/types.ts) — toujours dérivé
      // côté serveur des reviews (POST /pois/:id/rate), jamais accepté en écriture directe.
      ratings: [] as number[],
      zoneGeometry: zoneGeometry ?? null,
      isPublic: isPublic !== false,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
    };

    await setPoi(poi);
    console.log(`✅ POI créé avec altitude: ${altitude || 'N/A'}m, capacité: ${capacity || 'N/A'}, difficulté: ${difficulty || 'N/A'}`);
    return c.json({ success: true, data: poi });
  } catch (error) {
    console.error("Error creating POI:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Update (patch) a POI — the owner, or an admin (super-admin, or zone-admin whose zone
// contains this POI), field allowlist enforced (disabledUntil is moderator-only).
app.put("/make-server-e51cba93/pois/:id", safeHandler(async (c: any) => {
  try {
    const id = c.req.param("id");
    const raw = await c.req.json();

    const existing = await getPoi(id);
    if (!existing) {
      return c.json({ success: false, error: "POI not found" }, 404);
    }

    const user = await getAuthedUser(c);
    const isOwner = !!user && !!existing.createdBy && existing.createdBy === user.id;
    const isModerator = await canModeratePoi(c, existing.position);
    if (!isOwner && !isModerator) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    // Allowlist: only known enrichment/content fields may be updated. `ratings` is excluded —
    // toujours dérivé côté serveur des reviews, jamais modifiable via cette route générique.
    const ALLOWED_FIELDS = new Set([
      "title", "description", "photos", "season", "waterProximity",
      "naturalWaterProximity", "regulations", "altitude", "capacity",
      "difficulty", "disabledUntil", "isPublic", "zoneGeometry",
      "position",
    ]);
    const updates = Object.fromEntries(
      Object.entries(raw).filter(([k]) => ALLOWED_FIELDS.has(k))
    );

    // La désactivation temporaire reste une action de modération, pas d'édition par le propriétaire.
    if (!isModerator) delete updates.disabledUntil;

    const lengthError = validateTextFieldLengths(updates);
    if (lengthError) {
      return c.json({ success: false, error: lengthError }, 400);
    }

    if ("photos" in updates && Array.isArray(updates.photos) && updates.photos.length > MAX_PHOTOS_PER_SPOT) {
      return c.json({ success: false, error: `Maximum ${MAX_PHOTOS_PER_SPOT} photos par spot` }, 400);
    }
    if ("photos" in updates && hasDataUriPhoto(updates.photos)) {
      return c.json({ success: false, error: "Les photos doivent être uploadées via /photos/upload, pas fournies en base64" }, 400);
    }

    if ("position" in updates) {
      const pos = updates.position;
      if (!pos || typeof pos.lat !== "number" || typeof pos.lng !== "number" || isNaN(pos.lat) || isNaN(pos.lng)) {
        return c.json({ success: false, error: "Position invalide" }, 400);
      }
    }

    // La zone doit englober la position à jour du spot (celle envoyée dans cette même
    // requête si le spot est aussi repositionné, sinon la position déjà enregistrée).
    const effectivePosition = updates.position ?? existing.position;
    if ("zoneGeometry" in updates && !isValidPoiZone(effectivePosition, updates.zoneGeometry)) {
      return c.json({ success: false, error: `Zone invalide : elle doit contenir le point du spot et ne pas dépasser ${MAX_POI_ZONE_AREA_M2} m²` }, 400);
    }
    // Si le spot est repositionné sans repasser par un redessin de zone, s'assurer que la
    // zone existante contient toujours le nouveau point (sinon la zone deviendrait incohérente).
    if ("position" in updates && !("zoneGeometry" in updates) && existing.zoneGeometry
        && !isValidPoiZone(effectivePosition, existing.zoneGeometry)) {
      return c.json({ success: false, error: "La nouvelle position sort de la zone du spot. Redessinez la zone ou supprimez-la avant de déplacer le spot." }, 400);
    }

    const updated = { ...existing, ...updates };
    await setPoi(updated);
    console.log(`✅ POI ${id} mis à jour (altitude: ${updated.altitude ?? 'N/A'}m, eau: ${updated.waterProximity ?? 'N/A'})`);
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating POI:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Add a rating to a POI — requires a logged-in user, rate-limited
app.post("/make-server-e51cba93/pois/:id/rate", safeHandler(async (c: any) => {
  const user = await getAuthedUser(c);
  if (!user) {
    return c.json({ success: false, error: "Connexion requise pour poster un avis" }, 401);
  }

  const ip = getClientIp(c);
  if (!(await checkRateLimit(`rate:${ip}`, 30))) {
    return c.json({ success: false, error: "Too many requests" }, 429);
  }

  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { rating, comment } = body;

    if (typeof rating !== 'number' || rating < 0 || rating > 5) {
      return c.json({ success: false, error: "Rating must be a number between 0 and 5" }, 400);
    }
    if (typeof comment !== 'string' || comment.trim().split(/\s+/).filter(Boolean).length < 3) {
      return c.json({ success: false, error: "Comment must be at least 3 words" }, 400);
    }

    const poi = await getPoi(id);
    if (!poi) {
      return c.json({ success: false, error: "POI not found" }, 404);
    }

    const review = { rating, comment: comment.trim(), createdAt: new Date().toISOString(), userId: user.id };
    const updatedPoi = {
      ...poi,
      ratings: [...(poi.ratings || []), rating],
      reviews: [...(poi.reviews || []), review],
    };
    await setPoi(updatedPoi);
    console.log(`✅ Note ajoutée au POI ${id}: ${rating}/5 — "${comment.trim()}"`);
    return c.json({ success: true, data: updatedPoi });
  } catch (error) {
    console.error("Error adding rating:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Record a view of a POI (dashboard "vues 30j" metric) — public, rate-limited, no auth
// required. Stored as one daily-bucket KV row per POI (not one row per view) so the
// table stays small regardless of traffic.
app.post("/make-server-e51cba93/pois/:id/view", safeHandler(async (c: any) => {
  const ip = getClientIp(c);
  if (!(await checkRateLimit(`view:${ip}`, 300))) {
    return c.json({ success: false, error: "Too many requests" }, 429);
  }

  try {
    const id = c.req.param("id");
    const poi = await getPoi(id);
    if (!poi) {
      return c.json({ success: false, error: "POI not found" }, 404);
    }

    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key = `poiview:${id}:${date}`;
    const existing = await kv.get(key);
    await kv.set(key, { poiId: id, date, count: (existing?.count ?? 0) + 1 });

    return c.json({ success: true });
  } catch (error) {
    console.error("Error recording POI view:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Views per POI over the last 30 days (dashboard) — any admin (super-admin or zone-admin)
app.get("/make-server-e51cba93/pois/views-30d", safeHandler(async (c: any) => {
  if (!(await requireAnyAdmin(c))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }
  try {
    const buckets = await kv.getByPrefix("poiview:");
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const counts: Record<string, number> = {};
    for (const bucket of buckets) {
      if (!bucket || bucket.date < cutoffStr) continue;
      counts[bucket.poiId] = (counts[bucket.poiId] ?? 0) + (bucket.count ?? 0);
    }

    return c.json({ success: true, data: counts });
  } catch (error) {
    console.error("Error computing 30-day views:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Delete a specific review — the review's author, or an admin (super-admin, or
// zone-admin whose zone contains this POI)
app.delete("/make-server-e51cba93/pois/:id/reviews/:createdAt", safeHandler(async (c: any) => {
  try {
    const id = c.req.param("id");
    const createdAt = decodeURIComponent(c.req.param("createdAt"));
    const poi = await getPoi(id);
    if (!poi) return c.json({ success: false, error: "POI not found" }, 404);

    const reviews: any[] = poi.reviews || [];
    const idxMatch = createdAt.match(/^__idx_(\d+)__$/);
    const targetReview = idxMatch ? reviews[parseInt(idxMatch[1], 10)] : reviews.find((r: any) => r.createdAt === createdAt);

    const user = await getAuthedUser(c);
    const isAuthor = !!user && !!targetReview?.userId && targetReview.userId === user.id;
    if (!isAuthor && !(await canModeratePoi(c, poi.position))) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    const updatedReviews = idxMatch
      ? reviews.filter((_, i) => i !== parseInt(idxMatch[1]))
      : reviews.filter((r: any) => r.createdAt !== createdAt);
    const updatedPoi = { ...poi, reviews: updatedReviews, ratings: updatedReviews.map((r: any) => r.rating) };
    await setPoi(updatedPoi);
    return c.json({ success: true, data: updatedPoi });
  } catch (error) {
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Reset ALL POIs — admin only (IMPORTANT: defined BEFORE the :id route)
app.delete("/make-server-e51cba93/pois", safeHandler(async (c: any) => {
  if (!(await requireAdmin(c))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    console.log("🗑️ Reset endpoint called - fetching all POIs...");
    const pois = await getAllPois();
    const ids = pois.map((poi: any) => poi.id);

    console.log(`📊 Found ${ids.length} POIs to delete`);
    if (ids.length > 0) {
      await deletePoisBulk(ids);
      console.log(`✅ Successfully deleted ${ids.length} POIs`);
    }
    return c.json({ success: true, deletedCount: ids.length });
  } catch (error) {
    console.error("❌ Error resetting POIs:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// ONE-OFF MIGRATION (Phase 1 perf) — copie les POIs de kv_store_e51cba93 vers la
// table `spots`. Ne touche PAS kv_store (lecture seule), upsert sur `id` donc
// idempotent et sans risque à ré-exécuter. Admin only. À supprimer une fois la
// Phase 2 (bascule des routes /pois sur `spots`) validée en prod.
app.post("/make-server-e51cba93/migrate-spots-to-table", safeHandler(async (c: any) => {
  if (!(await requireAdmin(c))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  try {
    const pois = await kv.getByPrefix("poi:");
    const rows: any[] = [];
    const skipped: string[] = [];

    for (const poi of pois as any[]) {
      const lat = poi?.position?.lat;
      const lng = poi?.position?.lng;
      if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng) || !poi?.id) {
        skipped.push(poi?.id ?? "(sans id)");
        continue;
      }
      const {
        position, id, title, season, isPublic, disabledUntil,
        createdBy, createdAt, altitude, capacity, difficulty,
        waterProximity, naturalWaterProximity, ...rest
      } = poi;
      rows.push({
        id,
        lat,
        lng,
        title: title ?? "",
        season: season ?? "toute-annee",
        is_public: isPublic !== false,
        disabled_until: disabledUntil ?? null,
        created_by: createdBy ?? null,
        created_at: createdAt ?? new Date().toISOString(),
        altitude: altitude ?? null,
        capacity: capacity ?? null,
        difficulty: difficulty ?? null,
        water_proximity: waterProximity ?? null,
        natural_water_proximity: naturalWaterProximity ?? null,
        detail: rest,
      });
    }

    const supabase = getServiceClient();
    const BATCH = 500;
    let migrated = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await supabase.from("spots").upsert(batch, { onConflict: "id" });
      if (error) {
        console.error("❌ Erreur migration spots (batch):", error);
        return c.json({ success: false, error: error.message, migratedSoFar: migrated }, 500);
      }
      migrated += batch.length;
    }

    console.log(`✅ Migration spots: ${migrated}/${pois.length} POIs copiés, ${skipped.length} ignorés`);
    return c.json({ success: true, totalKvPois: pois.length, migrated, skipped });
  } catch (error) {
    console.error("❌ Error migrating spots:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// --- Zone-admin grants management — super-admin only ---

async function findUserIdByEmail(email: string): Promise<string | null> {
  const adminClient = getServiceClient();
  const normalized = email.trim().toLowerCase();
  let page = 1;
  const perPage = 200;
  for (let i = 0; i < 25; i++) { // safety cap: 5000 users max
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error || !data?.users?.length) break;
    const match = data.users.find((u: any) => u.email?.toLowerCase() === normalized);
    if (match) return match.id;
    if (data.users.length < perPage) break;
    page++;
  }
  return null;
}

// List all zone-admin grants, with territory name and grantee email resolved for display
app.get("/make-server-e51cba93/zone-admins", safeHandler(async (c: any) => {
  if (!(await requireAdmin(c))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }
  try {
    const adminClient = getServiceClient();
    const { data: grants, error } = await adminClient
      .from("zone_admins")
      .select("id, user_id, admin_zone_id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const zoneIds = [...new Set((grants ?? []).map((g: any) => g.admin_zone_id))];
    const { data: zones } = zoneIds.length
      ? await adminClient.from("admin_zones").select("id, name").in("id", zoneIds)
      : { data: [] as any[] };
    const zoneNameById = new Map((zones ?? []).map((z: any) => [z.id, z.name]));

    const { data: usersPage } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 });
    const emailById = new Map((usersPage?.users ?? []).map((u: any) => [u.id, u.email]));

    const enriched = (grants ?? []).map((g: any) => ({
      id: g.id,
      adminZoneId: g.admin_zone_id,
      zoneName: zoneNameById.get(g.admin_zone_id) ?? g.admin_zone_id,
      userId: g.user_id,
      email: emailById.get(g.user_id) ?? g.user_id,
      createdAt: g.created_at,
    }));

    return c.json({ success: true, data: enriched });
  } catch (error) {
    console.error("Error listing zone admins:", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
}));

// Grant zone-admin rights over a territory (admin_zone) to a user, by email
app.post("/make-server-e51cba93/zone-admins", safeHandler(async (c: any) => {
  const grantedBy = await getAuthedUser(c);
  if (!grantedBy || !(await isSuperAdmin(grantedBy.id))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }
  try {
    const body = await c.req.json();
    const email = String(body.email ?? "").trim();
    const adminZoneId = String(body.adminZoneId ?? "").trim();
    if (!email || !adminZoneId) {
      return c.json({ success: false, error: "Missing email or adminZoneId" }, 400);
    }

    const adminClient = getServiceClient();
    let userId = await findUserIdByEmail(email);
    let invited = false;

    if (!userId) {
      // Personne sans compte : on l'invite par email (Supabase gère l'envoi). Le compte
      // est créé immédiatement (état "invité"), donc on peut lui attribuer le territoire
      // dès maintenant — il le retrouvera en se connectant après avoir accepté l'invitation.
      const redirectTo = Deno.env.get("APP_URL") ?? "https://bivouac.vercel.app";
      const { data: invite, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo });
      if (inviteError || !invite?.user) {
        return c.json({ success: false, error: inviteError?.message || "Impossible d'inviter cet utilisateur" }, 500);
      }
      userId = invite.user.id;
      invited = true;
    }

    const { data, error } = await adminClient
      .from("zone_admins")
      .insert({ user_id: userId, admin_zone_id: adminZoneId, granted_by: grantedBy.id })
      .select()
      .single();
    if (error) throw error;

    return c.json({ success: true, data, invited });
  } catch (error) {
    console.error("Error granting zone admin:", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
}));

// Revoke a zone-admin grant
app.delete("/make-server-e51cba93/zone-admins/:id", safeHandler(async (c: any) => {
  if (!(await requireAdmin(c))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }
  try {
    const id = c.req.param("id");
    const { error } = await getServiceClient().from("zone_admins").delete().eq("id", id);
    if (error) throw error;
    return c.json({ success: true });
  } catch (error) {
    console.error("Error revoking zone admin:", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
}));

// --- User directory management — super-admin only (except email resolution) ---

// List every registered user with their activity (spots created, reviews left) — super-admin only
app.get("/make-server-e51cba93/users", safeHandler(async (c: any) => {
  if (!(await requireAdmin(c))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }
  try {
    const adminClient = getServiceClient();
    const allUsers: any[] = [];
    let page = 1;
    const perPage = 200;
    for (let i = 0; i < 25; i++) { // safety cap: 5000 users max
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (error || !data?.users?.length) break;
      allUsers.push(...data.users);
      if (data.users.length < perPage) break;
      page++;
    }

    const pois = await getAllPois();
    const spotsCount = new Map<string, number>();
    const reviewsCount = new Map<string, number>();
    for (const poi of pois) {
      if (poi?.createdBy) spotsCount.set(poi.createdBy, (spotsCount.get(poi.createdBy) ?? 0) + 1);
      for (const review of (poi?.reviews || [])) {
        if (review?.userId) reviewsCount.set(review.userId, (reviewsCount.get(review.userId) ?? 0) + 1);
      }
    }

    const enriched = allUsers.map((u: any) => ({
      id: u.id,
      email: u.email,
      createdAt: u.created_at,
      spotsCount: spotsCount.get(u.id) ?? 0,
      reviewsCount: reviewsCount.get(u.id) ?? 0,
    }));

    return c.json({ success: true, data: enriched });
  } catch (error) {
    console.error("Error listing users:", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
}));

// Resolve emails for a set of user ids — any admin (used by the spots table's author column,
// including zone-admins who can't call the full /users listing above)
app.post("/make-server-e51cba93/users/emails", safeHandler(async (c: any) => {
  const requester = await getAuthedUser(c);
  if (!requester || !(await isAnyAdmin(requester.id))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }
  try {
    const body = await c.req.json();
    let ids = Array.isArray(body.ids)
      ? [...new Set(body.ids.filter((id: unknown) => typeof id === "string"))].slice(0, 500)
      : [];

    // A zone-admin (not super-admin) may only resolve emails for authors of POIs located
    // in one of their own administration territories — not the whole user base.
    if (!(await isSuperAdmin(requester.id))) {
      const zones = await getModeratorZoneGeometries(requester.id);
      const pois = await getAllPois();
      const allowedAuthorIds = new Set(
        pois
          .filter((p: any) => p?.createdBy && zones.some((z: any) => isPointInZoneGeometry(p.position, z.geometry)))
          .map((p: any) => p.createdBy)
      );
      ids = ids.filter((id) => allowedAuthorIds.has(id));
    }

    const adminClient = getServiceClient();
    const entries = await Promise.all(ids.map(async (id) => {
      const { data } = await adminClient.auth.admin.getUserById(id as string);
      return [id, data?.user?.email ?? null] as const;
    }));
    const emailById = Object.fromEntries(entries.filter(([, email]) => !!email));

    return c.json({ success: true, data: emailById });
  } catch (error) {
    console.error("Error resolving user emails:", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
}));

// Delete a user account — super-admin only, with optional cascade over their spots/reviews
app.delete("/make-server-e51cba93/users/:id", safeHandler(async (c: any) => {
  const requester = await getAuthedUser(c);
  if (!requester || !(await isSuperAdmin(requester.id))) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }
  try {
    const id = c.req.param("id");
    if (id === requester.id) {
      return c.json({ success: false, error: "Vous ne pouvez pas supprimer votre propre compte" }, 400);
    }

    const body = await c.req.json().catch(() => ({}));
    const deleteSpots = !!body.deleteSpots;
    const deleteReviews = !!body.deleteReviews;

    if (deleteSpots || deleteReviews) {
      const pois = await getAllPois();

      if (deleteSpots) {
        const ownIds = pois.filter((p: any) => p.createdBy === id).map((p: any) => p.id);
        if (ownIds.length > 0) await deletePoisBulk(ownIds);
      }

      if (deleteReviews) {
        const remaining = deleteSpots ? pois.filter((p: any) => p.createdBy !== id) : pois;
        for (const poi of remaining) {
          const reviews: any[] = poi.reviews || [];
          if (!reviews.some((r: any) => r.userId === id)) continue;
          const updatedReviews = reviews.filter((r: any) => r.userId !== id);
          const updated = { ...poi, reviews: updatedReviews, ratings: updatedReviews.map((r: any) => r.rating) };
          await setPoi(updated);
        }
      }
    }

    const adminClient = getServiceClient();
    const { error } = await adminClient.auth.admin.deleteUser(id);
    if (error) {
      return c.json({ success: false, error: error.message || "Échec de la suppression du compte" }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return c.json({ success: false, error: "Internal server error" }, 500);
  }
}));

// Enrich a POI (altitude, water proximity) — called automatically by any logged-in
// visitor opening a spot whose enrichment fields are still empty (lazy fill, see
// src/app/hooks/usePois.ts). NOT owner/moderator-gated by design — but a field is only
// ever filled in when currently empty, never overwritten, so a malicious authenticated
// user can't vandalize an already-enriched spot.
const isValidWaterProximity = (v: unknown) => v === null || v === "proche" || v === "éloigné";
const isValidNaturalWaterProximity = (v: unknown) => v === null || v === "proche";
const isValidAltitude = (v: unknown) => typeof v === "number" && isFinite(v) && v >= -500 && v <= 9000;

app.patch("/make-server-e51cba93/pois/:id/enrich", safeHandler(async (c: any) => {
  const user = await getAuthedUser(c);
  if (!user) {
    return c.json({ success: false, error: "Connexion requise" }, 401);
  }

  const ip = getClientIp(c);
  if (!(await checkRateLimit(`enrich:${ip}`, 60))) {
    return c.json({ success: false, error: "Too many requests" }, 429);
  }

  try {
    const id = c.req.param("id");
    const raw = await c.req.json();

    const existing = await getPoi(id);
    if (!existing) {
      return c.json({ success: false, error: "POI not found" }, 404);
    }

    const VALIDATORS: Record<string, (v: unknown) => boolean> = {
      altitude: isValidAltitude,
      waterProximity: isValidWaterProximity,
      naturalWaterProximity: isValidNaturalWaterProximity,
    };
    const updates = Object.fromEntries(
      Object.entries(raw).filter(([k, v]) =>
        VALIDATORS[k] && (existing[k] === undefined || existing[k] === null) && VALIDATORS[k](v)
      )
    );
    if (Object.keys(updates).length === 0) {
      return c.json({ success: true, data: existing });
    }

    const updated = { ...existing, ...updates };
    await setPoi(updated);
    console.log(`✅ POI ${id} enrichi (altitude: ${updated.altitude ?? 'N/A'}m, eau: ${updated.waterProximity ?? 'N/A'}, naturelle: ${updated.naturalWaterProximity ?? 'N/A'})`);
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error("Error enriching POI:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Détail complet d'un POI (photos, reviews, description, regulations, zoneGeometry...) —
// appelé à l'ouverture d'un spot puisque GET /pois (liste) ne renvoie plus ces champs.
// IMPORTANT: enregistrée APRÈS toutes les routes GET /pois/<literal> ci-dessus
// (admin-list, my-reviews, views-30d), sinon ce :id générique les intercepterait.
app.get("/make-server-e51cba93/pois/:id", safeHandler(async (c: any) => {
  try {
    const id = c.req.param("id");
    const poi = await getPoi(id);
    if (!poi) {
      return c.json({ success: false, error: "POI not found" }, 404);
    }

    if (poi.isPublic === false) {
      const ctx = await getModerationContext(c);
      const isOwner = !!ctx.userId && poi.createdBy === ctx.userId;
      const isModerator = ctx.isSuper || ctx.zones.some((z: any) => isPointInZoneGeometry(poi.position, z.geometry));
      if (!isOwner && !isModerator) {
        return c.json({ success: false, error: "Unauthorized" }, 401);
      }
    }

    return c.json({ success: true, data: poi });
  } catch (error) {
    console.error("Error fetching POI detail:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Delete a single POI — the spot's creator, or an admin (super-admin, or zone-admin
// whose zone contains this POI)
app.delete("/make-server-e51cba93/pois/:id", safeHandler(async (c: any) => {
  try {
    const id = c.req.param("id");
    const existing = await getPoi(id);
    if (!existing) {
      return c.json({ success: false, error: "POI not found" }, 404);
    }

    const user = await getAuthedUser(c);
    const isOwner = !!user && !!existing.createdBy && existing.createdBy === user.id;
    if (!isOwner && !(await canModeratePoi(c, existing.position))) {
      return c.json({ success: false, error: "Unauthorized" }, 401);
    }

    console.log(`🗑️ Deleting POI with id: ${id}`);
    await deletePoi(id);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting POI:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// --- Photos de spots — Supabase Storage (bucket public `spot-photos`) ---
// Remplace le stockage base64 inline dans `detail` (jusqu'à 2,5 Mo/photo transportés
// à chaque fetch de spot). Upload requiert un compte, rate-limité comme la création
// de spot ; le bucket étant public, la lecture ne passe pas par cette fonction.

const MAX_PHOTO_UPLOAD_BYTES = 3 * 1024 * 1024;

// Allowlist of accepted image types, each verified against the actual file bytes (not just
// the client-supplied Content-Type header) — rejects e.g. an `image/svg+xml` upload carrying
// a stored-XSS payload, since the bucket serves uploads back as public, directly-openable URLs.
const PHOTO_MAGIC_BYTES: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/png": (b) => b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  "image/jpeg": (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/webp": (b) => b.length >= 12
    && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
};

app.post("/make-server-e51cba93/photos/upload", safeHandler(async (c: any) => {
  const user = await getAuthedUser(c);
  if (!user) {
    return c.json({ success: false, error: "Connexion requise pour ajouter une photo" }, 401);
  }

  const ip = getClientIp(c);
  if (!(await checkRateLimit(`photo-upload:${ip}`, 60))) {
    return c.json({ success: false, error: "Too many requests" }, 429);
  }

  try {
    const contentType = c.req.header("Content-Type") || "";
    const magicCheck = PHOTO_MAGIC_BYTES[contentType];
    if (!magicCheck) {
      return c.json({ success: false, error: "Type de fichier invalide" }, 400);
    }

    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_PHOTO_UPLOAD_BYTES) {
      return c.json({ success: false, error: "Fichier invalide ou trop volumineux" }, 400);
    }
    if (!magicCheck(bytes)) {
      return c.json({ success: false, error: "Le contenu du fichier ne correspond pas au type déclaré" }, 400);
    }

    const ext = contentType.split("/")[1]?.split("+")[0]?.replace(/[^a-z0-9]/gi, "") || "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

    const supabase = getServiceClient();
    const { error: uploadError } = await supabase.storage
      .from("spot-photos")
      .upload(path, bytes, { contentType, upsert: false });
    if (uploadError) {
      console.error("Error uploading photo to storage:", uploadError);
      return c.json({ success: false, error: "Échec de l'upload de la photo" }, 500);
    }

    const { data } = supabase.storage.from("spot-photos").getPublicUrl(path);
    return c.json({ success: true, url: data.publicUrl });
  } catch (error) {
    console.error("Error handling photo upload:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Altitude proxy — public read
app.get("/make-server-e51cba93/altitude", safeHandler(async (c: any) => {
  const ip = getClientIp(c);
  if (!(await checkRateLimit(`altitude:${ip}`, 120))) {
    return c.json({ success: false, error: "Too many requests" }, 429);
  }

  try {
    const lat = c.req.query("lat");
    const lng = c.req.query("lng");

    if (!lat || !lng) {
      return c.json({ success: false, error: "Missing lat/lng parameters" }, 400);
    }

    // Validate that lat/lng are finite numbers in valid ranges
    const latN = Number(lat);
    const lngN = Number(lng);
    if (!isFinite(latN) || latN < -90 || latN > 90 || !isFinite(lngN) || lngN < -180 || lngN > 180) {
      return c.json({ success: false, error: "Invalid lat/lng parameters" }, 400);
    }

    const response = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${latN}&longitude=${lngN}`,
      { headers: { 'User-Agent': 'bivouac-app/1.0' } }
    );

    if (!response.ok) {
      throw new Error(`Open-Meteo elevation error: ${response.status}`);
    }

    const data = await response.json();
    const altitude = data.elevation?.[0];

    if (altitude === undefined || altitude === null) {
      return c.json({ success: false, error: "No elevation data" }, 404);
    }

    console.log(`✅ Altitude: ${Math.round(altitude)}m pour (${latN}, ${lngN})`);
    return c.json({ success: true, altitude: Math.round(altitude) });
  } catch (error) {
    console.error("Error fetching altitude:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Overpass proxy — drinking water points
app.post("/make-server-e51cba93/water-points", safeHandler(async (c: any) => {
  const ip = getClientIp(c);
  if (!(await checkRateLimit(`water-points:${ip}`, 60))) {
    return c.json({ success: false, error: "Too many requests" }, 429);
  }

  try {
    const body = await c.req.json();

    let south: number, west: number, north: number, east: number;
    try {
      ({ south, west, north, east } = validateBounds(body));
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 400);
    }
    const timeout = validateTimeout(body.timeout);

    const query = `[out:json][timeout:${timeout}];(node["amenity"="drinking_water"]["access"!="private"](${south},${west},${north},${east});node["amenity"="water_point"]["access"!="private"](${south},${west},${north},${east});node["natural"="spring"]["access"!="private"](${south},${west},${north},${east});node["man_made"="water_well"]["access"!="private"](${south},${west},${north},${east}););out body qt;(way["natural"="water"]["access"!="private"](${south},${west},${north},${east});relation["natural"="water"]["access"!="private"](${south},${west},${north},${east}););out tags center qt;`;

    const ENDPOINTS = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.openstreetmap.ru/api/interpreter',
      'https://overpass.nchc.org.tw/api/interpreter',
    ];

    const HEADERS = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'bivouac-app/1.0 (contact: github.com/PierreGR01/bivouac)',
    };

    let lastError: string = 'No endpoint succeeded';
    for (const endpoint of ENDPOINTS) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 30000);
      try {
        console.log(`🔍 Tentative Overpass: ${endpoint}`);
        const resp = await fetch(endpoint, {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: HEADERS,
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        console.log(`📡 ${endpoint} → ${resp.status}`);
        if (resp.ok) {
          const data = await resp.json();
          console.log(`✅ Overpass proxy: ${(data.elements || []).length} éléments depuis ${endpoint}`);
          return c.json({ success: true, data });
        }
        const bodyText = await resp.text().catch(() => '');
        lastError = `HTTP ${resp.status} from ${endpoint}: ${bodyText.slice(0, 200)}`;
      } catch (err: any) {
        clearTimeout(timer);
        lastError = `${endpoint}: ${err?.message || 'fetch error'}`;
        console.warn(`⚠️ Overpass ${endpoint} erreur: ${lastError}`);
      }
    }

    console.error(`❌ Tous les endpoints Overpass ont échoué`);
    return c.json({ success: false, error: 'All Overpass endpoints failed' }, 503);
  } catch (error) {
    console.error("Error proxying Overpass:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Overpass proxy — streams/rivers for proximity calculation
app.post("/make-server-e51cba93/stream-points", safeHandler(async (c: any) => {
  const ip = getClientIp(c);
  if (!(await checkRateLimit(`stream-points:${ip}`, 60))) {
    return c.json({ success: false, error: "Too many requests" }, 429);
  }

  try {
    const body = await c.req.json();

    let south: number, west: number, north: number, east: number;
    try {
      ({ south, west, north, east } = validateBounds(body));
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 400);
    }

    const query = `[out:json][timeout:10];(way["waterway"~"^(stream|river|canal|ditch|drain|creek)$"]["access"!="private"](${south},${west},${north},${east}););out geom qt;`;
    const HEADERS = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'bivouac-app/1.0 (contact: github.com/PierreGR01/bivouac)',
    };
    const ENDPOINTS = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ];
    for (const endpoint of ENDPOINTS) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      try {
        const resp = await fetch(endpoint, { method: 'POST', body: `data=${encodeURIComponent(query)}`, headers: HEADERS, signal: ctrl.signal });
        clearTimeout(timer);
        if (resp.ok) {
          const data = await resp.json();
          return c.json({ success: true, data });
        }
      } catch (_err) { clearTimeout(timer); }
    }
    return c.json({ success: false, error: 'All endpoints failed' }, 503);
  } catch (error) {
    console.error("Error proxying stream-points:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Overpass proxy — protected areas
app.post("/make-server-e51cba93/protected-areas", safeHandler(async (c: any) => {
  const ip = getClientIp(c);
  if (!(await checkRateLimit(`protected-areas:${ip}`, 60))) {
    return c.json({ success: false, error: "Too many requests" }, 429);
  }

  try {
    const body = await c.req.json();

    let south: number, west: number, north: number, east: number;
    try {
      ({ south, west, north, east } = validateBounds(body));
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 400);
    }
    const timeout = validateTimeout(body.timeout, 90);

    const bbox = `${south},${west},${north},${east}`;
    const query = `[out:json][timeout:${timeout}];(relation["boundary"="national_park"](${bbox});relation["boundary"="protected_area"](${bbox});relation["leisure"="nature_reserve"](${bbox});way["leisure"="nature_reserve"](${bbox});relation["designation"~"parc|réserve|arrêté|protected|park|reserve"](${bbox});way["designation"~"parc|réserve|arrêté|protected|park|reserve"](${bbox});relation["camping"~"no|forbidden|prohibited"](${bbox});way["camping"~"no|forbidden|prohibited"](${bbox});relation["bivouac"~"no|forbidden|prohibited"](${bbox});way["bivouac"~"no|forbidden|prohibited"](${bbox});relation["access"="no"](${bbox});way["access"="no"](${bbox}););out geom;`;

    const ENDPOINTS = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
      'https://overpass.openstreetmap.ru/api/interpreter',
      'https://overpass.nchc.org.tw/api/interpreter',
    ];

    const HEADERS = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'bivouac-app/1.0 (contact: github.com/PierreGR01/bivouac)',
    };

    let lastError = 'No endpoint succeeded';
    for (const endpoint of ENDPOINTS) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), (timeout + 5) * 1000);
      try {
        console.log(`🔍 Zones protégées: ${endpoint}`);
        const resp = await fetch(endpoint, {
          method: 'POST',
          body: `data=${encodeURIComponent(query)}`,
          headers: HEADERS,
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        console.log(`📡 ${endpoint} → ${resp.status}`);
        if (resp.ok) {
          const data = await resp.json();
          console.log(`✅ Zones protégées proxy: ${(data.elements || []).length} éléments depuis ${endpoint}`);
          return c.json({ success: true, data });
        }
        lastError = `HTTP ${resp.status} from ${endpoint}`;
      } catch (err: any) {
        clearTimeout(timer);
        lastError = `${endpoint}: ${err?.message || 'fetch error'}`;
        console.warn(`⚠️ ${lastError}`);
      }
    }

    console.error(`❌ Tous les endpoints Overpass ont échoué`);
    return c.json({ success: false, error: 'All Overpass endpoints failed' }, 503);
  } catch (error) {
    console.error("Error proxying protected areas:", error);
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Overpass proxy — fetch single OSM zone by type+id (for geometry reset)
app.post("/make-server-e51cba93/protected-areas-by-id", safeHandler(async (c: any) => {
  const ip = getClientIp(c);
  if (!(await checkRateLimit(`protected-areas-by-id:${ip}`, 60))) {
    return c.json({ success: false, error: "Too many requests" }, 429);
  }

  try {
    const body = await c.req.json();
    const type = String(body.type ?? '');
    const id = String(body.id ?? '');
    if (!['relation', 'way'].includes(type) || !id.match(/^\d+$/)) {
      return c.json({ success: false, error: 'Invalid type or id' }, 400);
    }

    // Pour une relation : récupère directement les outer ways comme éléments individuels
    // (plus fiable que relation(id);out geom; qui retourne la géométrie en inline dans les membres)
    const query = type === 'relation'
      ? `[out:json][timeout:60];relation(${id})->.r;way(r.r:"outer");out geom;`
      : `[out:json][timeout:30];way(${id});out geom;`;

    const HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'User-Agent': 'bivouac-app/1.0' };
    const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

    for (const endpoint of ENDPOINTS) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 65000);
      try {
        const resp = await fetch(endpoint, { method: 'POST', body: `data=${encodeURIComponent(query)}`, headers: HEADERS, signal: ctrl.signal });
        clearTimeout(timer);
        if (resp.ok) {
          const data = await resp.json();
          console.log(`✅ Zone OSM ${type}(${id}): ${(data.elements || []).length} éléments`);
          return c.json({ success: true, data });
        }
      } catch (_err) { clearTimeout(timer); }
    }
    return c.json({ success: false, error: 'All Overpass endpoints failed' }, 503);
  } catch (error) {
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

// Overpass proxy — protected area names only (for admin dropdown, no geometry)
app.post("/make-server-e51cba93/protected-areas-names", safeHandler(async (c: any) => {
  const ip = getClientIp(c);
  if (!(await checkRateLimit(`protected-areas-names:${ip}`, 60))) {
    return c.json({ success: false, error: "Too many requests" }, 429);
  }

  try {
    const body = await c.req.json();
    let south: number, west: number, north: number, east: number;
    try {
      ({ south, west, north, east } = validateBounds(body));
    } catch (err: any) {
      return c.json({ success: false, error: err.message }, 400);
    }
    const bbox = `${south},${west},${north},${east}`;
    const query = `[out:json][timeout:15];(relation["boundary"="national_park"](${bbox});relation["boundary"="protected_area"](${bbox});relation["leisure"="nature_reserve"](${bbox}););out tags;`;

    const HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'User-Agent': 'bivouac-app/1.0' };
    const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

    for (const endpoint of ENDPOINTS) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 18000);
      try {
        const resp = await fetch(endpoint, { method: 'POST', body: `data=${encodeURIComponent(query)}`, headers: HEADERS, signal: ctrl.signal });
        clearTimeout(timer);
        if (resp.ok) {
          const data = await resp.json();
          return c.json({ success: true, data });
        }
      } catch (_err) { clearTimeout(timer); }
    }
    return c.json({ success: false, error: 'All Overpass endpoints failed' }, 503);
  } catch (error) {
    return c.json({ success: false, error: 'Internal server error' }, 500);
  }
}));

app.onError((error: any, c: any) => {
  if (
    error?.code === 'EPIPE' ||
    error?.name === 'Http' ||
    error?.message?.includes('connection closed') ||
    error?.message?.includes('broken pipe')
  ) {
    console.log('ℹ️ Client a fermé la connexion (ignoré dans onError)');
    return new Response(null, { status: 499 });
  }
  console.error('❌ Erreur non gérée:', error);
  return c.json({ success: false, error: 'Internal server error' }, 500);
});

const serveSafe = async (request: Request) => {
  try {
    return await app.fetch(request);
  } catch (error: any) {
    if (
      error?.code === 'EPIPE' ||
      error?.name === 'Http' ||
      error?.message?.includes('connection closed') ||
      error?.message?.includes('broken pipe')
    ) {
      console.log('ℹ️ Client a fermé la connexion avant la réponse (ignoré au niveau serve)');
      return new Response(null, { status: 499 });
    }
    console.error('❌ Erreur fatale dans Deno.serve:', error);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

Deno.serve(serveSafe);
