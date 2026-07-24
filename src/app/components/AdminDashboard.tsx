import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Tent,
  X,
  Mail,
  ShieldCheck,
  MapPin,
  Image as ImageIcon,
  Eye,
  Map as MapIcon,
  Ban,
  PlayCircle,
  Trash2,
  Check,
  X as XIcon,
  Loader2,
  KeyRound,
  Settings,
  LogOut,
  Plus,
} from 'lucide-react';
import { PoiLocation, PoiAdminSummary } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { BivouacButton } from './ui/bivouac-button';
import { Input } from './ui/bivouac-input';
import { StatusBadge } from './ui/bivouac-badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { AdminZonesManager } from './AdminZonesManager';
import { fetchAdminZones, AdminZone } from '../../utils/supabase/admin-zones-api';
import { fetchPoiViews30d, fetchAdminPoisPage } from '../../utils/supabase/api';
import { updatePassword } from '../../utils/supabase/auth';
import { fetchUsers, fetchAuthorEmails, deleteUser, AdminUserSummary } from '../../utils/supabase/users-api';
import { isSpotDisabled, computeDisabledUntil, DISABLE_DURATIONS } from '../utils/spot-status';

interface AdminDashboardProps {
  onClose: () => void;
  locations: PoiLocation[];
  onViewOnMap: (poi: PoiLocation) => void;
  onSetDisabled: (poiId: string, disabledUntil: string | null) => Promise<boolean>;
  onDeleteSpot: (poiId: string) => Promise<boolean>;
  onOpenZonesEditor: () => void;
  // Dessiner un nouveau territoire ou modifier le tracé d'un territoire existant nécessite
  // la carte plein écran — ces deux actions quittent donc le dashboard. La liste des
  // territoires et leurs admins, elle, reste affichée dans le dashboard (cf. showTerritories).
  onOpenTerritoryEditor: (zone?: AdminZone) => void;
  onRefetchPois: () => void;
}

function formatShortDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
}

const ADMIN_SPOTS_PAGE_SIZE = 50;

export function AdminDashboard({
  onClose,
  locations,
  onViewOnMap,
  onSetDisabled,
  onDeleteSpot,
  onOpenZonesEditor,
  onOpenTerritoryEditor,
  onRefetchPois,
}: AdminDashboardProps) {
  const { currentUser, isSuperAdmin, zoneAdminIds, logout } = useAuth();
  const [adminZones, setAdminZones] = useState<AdminZone[]>([]);
  const [views30d, setViews30d] = useState<Record<string, number>>({});
  const [emailById, setEmailById] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<string | null>(null);
  const [deleteUserSpots, setDeleteUserSpots] = useState(false);
  const [deleteUserReviews, setDeleteUserReviews] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // Tableau "Spots" — paginé côté serveur (GET /pois/admin-list) plutôt que dérivé de
  // la prop `locations` complète : un territoire ou toute la plateforme peut compter
  // des centaines/milliers de spots, et cette route ne renvoie jamais les champs lourds
  // (photos/reviews/description) — seulement un `photosCount` calculé côté serveur.
  const [spotRows, setSpotRows] = useState<PoiAdminSummary[]>([]);
  const [spotsCursor, setSpotsCursor] = useState<string | null>(null);
  const [spotsTotal, setSpotsTotal] = useState(0);
  const [spotsLoadingMore, setSpotsLoadingMore] = useState(false);

  const loadMoreSpots = async () => {
    if (spotsLoadingMore) return;
    setSpotsLoadingMore(true);
    try {
      const page = await fetchAdminPoisPage(spotsCursor, ADMIN_SPOTS_PAGE_SIZE);
      setSpotRows((prev) => [...prev, ...page.data]);
      setSpotsCursor(page.nextCursor);
      setSpotsTotal(page.total);
    } catch (error) {
      console.error('Error loading spots page:', error);
      toast.error('Impossible de charger la suite des spots');
    } finally {
      setSpotsLoadingMore(false);
    }
  };

  // Repère vers l'objet complet (`locations`, prop déjà chargée par ailleurs) pour les
  // actions qui ont besoin de plus que le résumé de la ligne (ex: ouvrir le détail sur
  // la carte). Depuis la Phase 4, `locations` est scopée à la zone de carte visible —
  // un spot du tableau admin situé hors de cette zone tombera sur le fallback ci-dessous.
  const locationById = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  // `description` volontairement absent (pas `''`) : c'est le signal que `usePois.ts`
  // (`selectLocation`) utilise pour savoir qu'il doit aller chercher le détail complet.
  const resolveFullLocation = (row: PoiAdminSummary): PoiLocation =>
    locationById.get(row.id) ?? ({
      id: row.id,
      position: row.position,
      title: row.title,
      photos: [],
      season: 'toute-annee',
      waterProximity: null,
      isPublic: row.isPublic,
      disabledUntil: row.disabledUntil,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    } as unknown as PoiLocation);

  useEffect(() => {
    void (async () => {
      setIsLoading(true);
      try {
        const [zonesData, viewsData, spotsPage] = await Promise.all([
          fetchAdminZones(),
          fetchPoiViews30d(),
          fetchAdminPoisPage(null, ADMIN_SPOTS_PAGE_SIZE),
        ]);
        setAdminZones(zonesData);
        setViews30d(viewsData);
        setSpotRows(spotsPage.data);
        setSpotsCursor(spotsPage.nextCursor);
        setSpotsTotal(spotsPage.total);

        if (isSuperAdmin) {
          const usersData = await fetchUsers();
          setUsers(usersData);
          setEmailById(Object.fromEntries(usersData.map((u) => [u.id, u.email])));
        } else {
          // Un admin de zone ne peut pas lister tous les comptes — on ne résout que les emails
          // des auteurs des spots de son propre territoire. Ne peut pas se contenter de
          // `locations` (scopée à la zone de carte visible depuis la Phase 4) ni de la seule
          // première page de `spotRows` : on reboucle sur admin-list jusqu'à épuisement pour
          // couvrir tout le territoire, quelle que soit sa taille.
          const allTerritorySpots: PoiAdminSummary[] = [...spotsPage.data];
          let cursor = spotsPage.nextCursor;
          while (cursor) {
            const page = await fetchAdminPoisPage(cursor, 200);
            allTerritorySpots.push(...page.data);
            cursor = page.nextCursor;
          }
          const ids = [...new Set(allTerritorySpots.map((l) => l.createdBy).filter((id): id is string => !!id))];
          const emails = await fetchAuthorEmails(ids);
          setEmailById(emails);
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        toast.error('Impossible de charger toutes les données du tableau de bord');
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myZones = useMemo(
    () => (isSuperAdmin ? adminZones : adminZones.filter((z) => zoneAdminIds.includes(z.id))),
    [adminZones, isSuperAdmin, zoneAdminIds]
  );

  const roleLabel = isSuperAdmin ? 'Super administrateur' : 'Administrateur de zone';
  const territoryLabel = isSuperAdmin
    ? 'Toute la plateforme'
    : myZones.length > 0
      ? myZones.map((z) => z.name).join(', ')
      : 'Aucun territoire assigné';

  const handleToggleDisabled = async (poi: PoiAdminSummary) => {
    setTogglingId(poi.id);
    try {
      const disabled = isSpotDisabled(poi);
      const nextValue = disabled ? null : computeDisabledUntil(DISABLE_DURATIONS[0].months);
      const success = await onSetDisabled(poi.id, nextValue);
      if (success) {
        setSpotRows((prev) => prev.map((r) => (r.id === poi.id ? { ...r, disabledUntil: nextValue } : r)));
        toast.success(disabled ? 'Spot réactivé' : `Spot désactivé pour ${DISABLE_DURATIONS[0].label}`);
      } else {
        toast.error('Action impossible sur ce spot');
      }
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmDelete = async (poiId: string) => {
    setDeletingId(poiId);
    try {
      const success = await onDeleteSpot(poiId);
      if (success) {
        setSpotRows((prev) => prev.filter((r) => r.id !== poiId));
        setSpotsTotal((prev) => Math.max(0, prev - 1));
        toast.success('Spot supprimé');
      } else {
        toast.error('Échec de la suppression');
      }
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleConfirmDeleteUser = async (user: AdminUserSummary) => {
    setDeletingUserId(user.id);
    try {
      await deleteUser(user.id, { deleteSpots: deleteUserSpots, deleteReviews: deleteUserReviews });
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success('Utilisateur supprimé');
      if (deleteUserSpots || deleteUserReviews) {
        onRefetchPois();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Échec de la suppression du compte');
    } finally {
      setDeletingUserId(null);
      setConfirmDeleteUserId(null);
      setDeleteUserSpots(false);
      setDeleteUserReviews(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }
    setIsSubmittingPassword(true);
    try {
      await updatePassword(newPassword);
      toast.success('Mot de passe mis à jour');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordForm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Échec de la mise à jour du mot de passe');
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      onClose();
    } catch {
      toast.error('Échec de la déconnexion');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="fixed inset-y-0 left-0 z-[1200] bg-white shadow-2xl flex flex-col w-full md:w-1/2">
      {/* Header — remplace le logo + barre de recherche habituels */}
      <header className="flex-shrink-0 flex items-center gap-3 px-4 md:px-6 py-3 border-b border-gray-100">
        <div className="bg-emerald-600 p-2 rounded-lg flex-shrink-0">
          <Tent className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-lg font-bold text-gray-800 flex-1 truncate">Tableau de bord d'administration</h1>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Retour à la carte"
          title="Retour à la carte"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          </div>
        ) : (
          <Tabs defaultValue="synthese">
            <TabsList className="w-full">
              <TabsTrigger value="synthese">Synthèse perso</TabsTrigger>
              <TabsTrigger value="territoires">Gestion des territoires</TabsTrigger>
              <TabsTrigger value="spots">Spots</TabsTrigger>
              {isSuperAdmin && <TabsTrigger value="utilisateurs">Utilisateurs</TabsTrigger>}
            </TabsList>

            {/* Synthèse perso */}
            <TabsContent value="synthese" className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                <p className="text-sm text-gray-600 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  {currentUser?.email}
                </p>
                <p className="text-sm text-gray-600 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                  <StatusBadge status="success">{roleLabel}</StatusBadge>
                </p>
                <p className="text-sm text-gray-600 flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>Territoire : {territoryLabel}</span>
                </p>
              </div>

              <div>
                <BivouacButton
                  variant="secondary"
                  size="sm"
                  icon={<KeyRound className="w-4 h-4" />}
                  onClick={() => setShowPasswordForm((v) => !v)}
                >
                  Modifier le mot de passe
                </BivouacButton>
                {showPasswordForm && (
                  <form onSubmit={handleChangePassword} className="space-y-3 mt-3">
                    <Input
                      label="Nouveau mot de passe"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      disabled={isSubmittingPassword}
                    />
                    <Input
                      label="Confirmer le mot de passe"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="new-password"
                      disabled={isSubmittingPassword}
                    />
                    <BivouacButton
                      type="submit"
                      variant="primary"
                      icon={isSubmittingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                      disabled={isSubmittingPassword || !newPassword || !confirmPassword}
                      className="w-full"
                    >
                      Changer le mot de passe
                    </BivouacButton>
                  </form>
                )}
              </div>

              <BivouacButton
                variant="destructive"
                icon={isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full"
              >
                Se déconnecter
              </BivouacButton>
            </TabsContent>

            {/* Gestion des territoires */}
            <TabsContent value="territoires" className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <BivouacButton
                  variant="secondary"
                  size="sm"
                  icon={<Settings className="w-4 h-4" />}
                  onClick={onOpenZonesEditor}
                >
                  Créer une zone réglementée
                </BivouacButton>
                {isSuperAdmin && (
                  <BivouacButton
                    variant="secondary"
                    size="sm"
                    icon={<Plus className="w-4 h-4" />}
                    onClick={() => onOpenTerritoryEditor()}
                  >
                    Attribuer la gestion d'un territoire
                  </BivouacButton>
                )}
              </div>
              {isSuperAdmin && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <AdminZonesManager
                    embedded
                    showCreateButton={false}
                    onCreateNew={() => onOpenTerritoryEditor()}
                    onEditZone={(zone) => onOpenTerritoryEditor(zone)}
                  />
                </div>
              )}
            </TabsContent>

            {/* Spots du territoire couvert */}
            <TabsContent value="spots">
              <StatusBadge status="info" className="mb-3">
                {spotsTotal} spot{spotsTotal !== 1 ? 's' : ''} intégré{spotsTotal !== 1 ? 's' : ''} à ce territoire
              </StatusBadge>

              {spotRows.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun spot dans ce territoire pour le moment.</p>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <div className="min-w-[760px]">
                  {/* En-tête */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                    <div className="flex-1 min-w-0">Titre du spot</div>
                    <div className="w-36 flex-shrink-0">Auteur</div>
                    <div className="w-16 flex-shrink-0 text-center">Créé le</div>
                    <div className="w-9 flex-shrink-0 text-center" title="Vues (30 derniers jours)">Vues</div>
                    <div className="w-9 flex-shrink-0 text-center" title="Photos">Médias</div>
                    <div className="w-[104px] flex-shrink-0 text-center">Actions</div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {spotRows.map((poi) => {
                      const disabled = isSpotDisabled(poi);
                      const isConfirmingDelete = confirmDeleteId === poi.id;
                      return (
                        <div
                          key={poi.id}
                          className={`flex items-center gap-2 px-3 py-2 ${disabled ? 'bg-gray-50/60' : ''}`}
                        >
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => onViewOnMap(resolveFullLocation(poi))}
                              className="text-left text-sm font-medium text-gray-800 hover:text-emerald-700 hover:underline truncate block w-full"
                              title={poi.title}
                            >
                              {poi.title}
                            </button>
                            {disabled && (
                              <span className="text-xs text-orange-600">Désactivé</span>
                            )}
                          </div>
                          <div className="w-36 flex-shrink-0 text-xs text-gray-600 truncate" title={poi.createdBy ? (emailById[poi.createdBy] ?? poi.createdBy) : undefined}>
                            {poi.createdBy ? (emailById[poi.createdBy] ?? '—') : '—'}
                          </div>
                          <div className="w-16 flex-shrink-0 text-center text-xs text-gray-600">
                            {formatShortDate(poi.createdAt)}
                          </div>
                          <div className="w-9 flex-shrink-0 flex items-center justify-center gap-0.5 text-xs text-gray-600">
                            <Eye className="w-3.5 h-3.5 flex-shrink-0" />
                            {views30d[poi.id] ?? 0}
                          </div>
                          <div className="w-9 flex-shrink-0 flex items-center justify-center gap-0.5 text-xs text-gray-600">
                            <ImageIcon className="w-3.5 h-3.5 flex-shrink-0" />
                            {poi.photosCount}
                          </div>
                          <div className="w-[104px] flex-shrink-0 flex items-center justify-center gap-1">
                            {isConfirmingDelete ? (
                              <>
                                <button
                                  onClick={() => handleConfirmDelete(poi.id)}
                                  disabled={deletingId === poi.id}
                                  title="Confirmer la suppression"
                                  className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                  {deletingId === poi.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  disabled={deletingId === poi.id}
                                  title="Annuler"
                                  className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                                >
                                  <XIcon className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => onViewOnMap(resolveFullLocation(poi))}
                                  title="Voir sur la carte"
                                  className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-emerald-700 transition-colors"
                                >
                                  <MapIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleToggleDisabled(poi)}
                                  disabled={togglingId === poi.id}
                                  title={disabled ? 'Réactiver' : 'Désactiver'}
                                  className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-orange-600 disabled:opacity-50 transition-colors"
                                >
                                  {togglingId === poi.id
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : disabled ? <PlayCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(poi.id)}
                                  title="Supprimer"
                                  className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </div>
                </div>
              )}

              {spotsCursor && (
                <div className="flex justify-center mt-3">
                  <BivouacButton
                    variant="secondary"
                    size="sm"
                    icon={spotsLoadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
                    onClick={loadMoreSpots}
                    disabled={spotsLoadingMore}
                  >
                    Charger plus de spots
                  </BivouacButton>
                </div>
              )}
            </TabsContent>

            {/* Utilisateurs enregistrés — super-admin uniquement */}
            {isSuperAdmin && (
              <TabsContent value="utilisateurs">
                <StatusBadge status="info" className="mb-3">
                  {users.length} utilisateur{users.length !== 1 ? 's' : ''} enregistré{users.length !== 1 ? 's' : ''}
                </StatusBadge>

                {users.length === 0 ? (
                  <p className="text-sm text-gray-500">Aucun utilisateur pour le moment.</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                      <div className="flex-1 min-w-0">Email</div>
                      <div className="w-12 flex-shrink-0 text-center">Spots</div>
                      <div className="w-12 flex-shrink-0 text-center">Avis</div>
                      <div className="w-9 flex-shrink-0 text-center">Actions</div>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {users.map((user) => {
                        const isConfirming = confirmDeleteUserId === user.id;
                        return isConfirming ? (
                          <div key={user.id} className="bg-red-50 border-t border-red-200 p-3">
                            <p className="text-sm text-red-800 font-medium mb-2">
                              Supprimer {user.email} ?
                            </p>
                            <label className="flex items-center gap-2 text-sm text-red-800 mb-1">
                              <input
                                type="checkbox"
                                checked={deleteUserSpots}
                                onChange={(e) => setDeleteUserSpots(e.target.checked)}
                                className="w-4 h-4 text-red-600 rounded focus:ring-2 focus:ring-red-500"
                              />
                              Supprimer aussi ses {user.spotsCount} spot{user.spotsCount !== 1 ? 's' : ''}
                            </label>
                            <label className="flex items-center gap-2 text-sm text-red-800 mb-3">
                              <input
                                type="checkbox"
                                checked={deleteUserReviews}
                                onChange={(e) => setDeleteUserReviews(e.target.checked)}
                                className="w-4 h-4 text-red-600 rounded focus:ring-2 focus:ring-red-500"
                              />
                              Supprimer aussi ses {user.reviewsCount} avis
                            </label>
                            <div className="flex gap-2">
                              <BivouacButton
                                variant="destructive"
                                size="sm"
                                icon={deletingUserId === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                onClick={() => handleConfirmDeleteUser(user)}
                                disabled={deletingUserId === user.id}
                                className="flex-1"
                              >
                                Confirmer
                              </BivouacButton>
                              <BivouacButton
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setConfirmDeleteUserId(null);
                                  setDeleteUserSpots(false);
                                  setDeleteUserReviews(false);
                                }}
                                disabled={deletingUserId === user.id}
                                className="flex-1"
                              >
                                Annuler
                              </BivouacButton>
                            </div>
                          </div>
                        ) : (
                          <div key={user.id} className="flex items-center gap-2 px-3 py-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate" title={user.email}>{user.email}</p>
                              <p className="text-xs text-gray-400">Inscrit le {formatShortDate(user.createdAt)}</p>
                            </div>
                            <div className="w-12 flex-shrink-0 text-center text-xs text-gray-600">{user.spotsCount}</div>
                            <div className="w-12 flex-shrink-0 text-center text-xs text-gray-600">{user.reviewsCount}</div>
                            <div className="w-9 flex-shrink-0 flex items-center justify-center">
                              <button
                                onClick={() => setConfirmDeleteUserId(user.id)}
                                title="Supprimer ce compte"
                                className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </div>
  );
}
