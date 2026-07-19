import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  Tent,
  X,
  Mail,
  MapPin as MapIcon,
  Upload,
  Trash2,
  Check,
  X as XIcon,
  Loader2,
  KeyRound,
  LogOut,
} from 'lucide-react';
import { PoiLocation, Review } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { BivouacButton } from './ui/bivouac-button';
import { Input } from './ui/bivouac-input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { TripNamePrompt } from './TripNamePrompt';
import * as api from '../../utils/supabase/api';
import { updatePassword } from '../../utils/supabase/auth';
import { Trip } from '../../utils/supabase/trips-api';
import { useFavorites } from '../hooks/useFavorites';
import { useTrips } from '../hooks/useTrips';
import { parseGpxOrKml, RoutePoint } from '../utils/gpx-kml-parser';

interface UserDashboardProps {
  onClose: () => void;
  locations: PoiLocation[];
  onViewSpotOnMap: (poi: PoiLocation) => void;
  onDeleteSpot: (poiId: string) => Promise<boolean>;
  onViewTripOnMap: (trip: Trip) => void;
}

interface RowProps {
  title: string;
  subtitle?: string;
  onViewOnMap: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  confirmDelete: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
}

function DashboardRow({ title, subtitle, onViewOnMap, onDelete, isDeleting, confirmDelete, onRequestDelete, onCancelDelete }: RowProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="flex-1 min-w-0">
        <button
          onClick={onViewOnMap}
          className="text-left text-sm font-medium text-gray-800 hover:text-emerald-700 hover:underline truncate block w-full"
          title={title}
        >
          {title}
        </button>
        {subtitle && <span className="text-xs text-gray-500 truncate block">{subtitle}</span>}
      </div>
      <div className="w-[72px] flex-shrink-0 flex items-center justify-center gap-1">
        {confirmDelete ? (
          <>
            <button
              onClick={onDelete}
              disabled={isDeleting}
              title="Confirmer la suppression"
              className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onCancelDelete}
              disabled={isDeleting}
              title="Annuler"
              className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onViewOnMap}
              title="Voir sur la carte"
              className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-emerald-700 transition-colors"
            >
              <MapIcon className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRequestDelete}
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
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-sm text-gray-500 px-1 py-4">{label}</p>;
}

export function UserDashboard({ onClose, locations, onViewSpotOnMap, onDeleteSpot, onViewTripOnMap }: UserDashboardProps) {
  const { currentUser, logout } = useAuth();
  const queryClient = useQueryClient();
  const favorites = useFavorites();
  const trips = useTrips();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<RoutePoint[] | null>(null);
  const [isSavingImport, setIsSavingImport] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const mySpots = useMemo(
    () => locations.filter((l) => l.createdBy === currentUser?.id),
    [locations, currentUser]
  );

  const myReviews = useMemo(
    () => locations.flatMap((poi) =>
      (poi.reviews || [])
        .filter((r) => r.userId === currentUser?.id)
        .map((review) => ({ review, poi }))
    ),
    [locations, currentUser]
  );

  const savedSpots = useMemo(
    () => locations.filter((l) => favorites.favoriteIds.has(l.id)),
    [locations, favorites.favoriteIds]
  );

  const handleDeleteSpot = async (poiId: string) => {
    setBusyId(poiId);
    try {
      const success = await onDeleteSpot(poiId);
      if (success) toast.success('Spot supprimé');
      else toast.error('Échec de la suppression');
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  };

  const handleDeleteReview = async (poi: PoiLocation, review: Review) => {
    const key = review.createdAt ?? `__idx_${(poi.reviews || []).indexOf(review)}__`;
    setBusyId(key);
    try {
      const updatedPoi = await api.deleteReview(poi.id, key);
      if (updatedPoi) {
        queryClient.setQueryData<PoiLocation[]>(['pois'], (old = []) =>
          old.map((p) => (p.id === poi.id ? updatedPoi : p))
        );
      }
      toast.success('Avis supprimé');
    } catch {
      toast.error("Impossible de supprimer l'avis");
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  };

  const handleRemoveFavorite = async (poiId: string) => {
    await favorites.toggleFavorite(poiId);
    setConfirmId(null);
  };

  const handleDeleteTrip = async (tripId: string) => {
    setBusyId(tripId);
    try {
      const success = await trips.removeTrip(tripId);
      if (success) toast.success('Itinéraire supprimé');
    } finally {
      setBusyId(null);
      setConfirmId(null);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const points = parseGpxOrKml(text, file.name);
      setPendingImport(points);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Impossible de lire ce fichier");
    }
  };

  const handleConfirmImport = async (name: string) => {
    if (!pendingImport) return;
    setIsSavingImport(true);
    try {
      const success = await trips.saveTrip({ name, points: pendingImport, source: 'import' });
      if (success) setPendingImport(null);
    } finally {
      setIsSavingImport(false);
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
      <header className="flex-shrink-0 flex items-center gap-3 px-4 md:px-6 py-3 border-b border-gray-100">
        <div className="bg-emerald-600 p-2 rounded-lg flex-shrink-0">
          <Tent className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-lg font-bold text-gray-800 flex-1 truncate">Mon tableau de bord</h1>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Retour à la carte"
          title="Retour à la carte"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <section className="space-y-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-sm text-gray-600 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
              {currentUser?.email}
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
        </section>

        <Tabs defaultValue="spots">
          <TabsList className="w-full">
            <TabsTrigger value="spots">Mes spots</TabsTrigger>
            <TabsTrigger value="reviews">Mes avis</TabsTrigger>
            <TabsTrigger value="saved">Enregistrés</TabsTrigger>
            <TabsTrigger value="trips">Mes trips</TabsTrigger>
          </TabsList>

          <TabsContent value="spots">
            {mySpots.length === 0 ? (
              <EmptyState label="Vous n'avez pas encore créé de spot." />
            ) : (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                {mySpots.map((poi) => (
                  <DashboardRow
                    key={poi.id}
                    title={poi.title}
                    onViewOnMap={() => onViewSpotOnMap(poi)}
                    onDelete={() => handleDeleteSpot(poi.id)}
                    isDeleting={busyId === poi.id}
                    confirmDelete={confirmId === poi.id}
                    onRequestDelete={() => setConfirmId(poi.id)}
                    onCancelDelete={() => setConfirmId(null)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="reviews">
            {myReviews.length === 0 ? (
              <EmptyState label="Vous n'avez pas encore posté d'avis." />
            ) : (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                {myReviews.map(({ review, poi }, i) => {
                  const key = review.createdAt ?? `__idx_${i}__`;
                  return (
                    <DashboardRow
                      key={`${poi.id}-${key}`}
                      title={poi.title}
                      subtitle={`${review.rating}/5 — ${review.comment}`}
                      onViewOnMap={() => onViewSpotOnMap(poi)}
                      onDelete={() => handleDeleteReview(poi, review)}
                      isDeleting={busyId === key}
                      confirmDelete={confirmId === key}
                      onRequestDelete={() => setConfirmId(key)}
                      onCancelDelete={() => setConfirmId(null)}
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="saved">
            {savedSpots.length === 0 ? (
              <EmptyState label="Aucun spot enregistré pour le moment." />
            ) : (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                {savedSpots.map((poi) => (
                  <DashboardRow
                    key={poi.id}
                    title={poi.title}
                    onViewOnMap={() => onViewSpotOnMap(poi)}
                    onDelete={() => handleRemoveFavorite(poi.id)}
                    isDeleting={false}
                    confirmDelete={confirmId === poi.id}
                    onRequestDelete={() => setConfirmId(poi.id)}
                    onCancelDelete={() => setConfirmId(null)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="trips">
            <div className="mb-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".gpx,.kml"
                onChange={handleFileSelected}
                className="hidden"
              />
              {pendingImport ? (
                <TripNamePrompt
                  onConfirm={handleConfirmImport}
                  onCancel={() => setPendingImport(null)}
                  isSubmitting={isSavingImport}
                />
              ) : (
                <BivouacButton
                  variant="secondary"
                  size="sm"
                  icon={<Upload className="w-4 h-4" />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Importer un fichier GPX/KML
                </BivouacButton>
              )}
            </div>

            {trips.isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
              </div>
            ) : trips.trips.length === 0 ? (
              <EmptyState label="Aucun itinéraire enregistré pour le moment." />
            ) : (
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden">
                {trips.trips.map((trip) => (
                  <DashboardRow
                    key={trip.id}
                    title={trip.name}
                    subtitle={trip.source === 'import' ? 'Importé' : 'Dessiné'}
                    onViewOnMap={() => onViewTripOnMap(trip)}
                    onDelete={() => handleDeleteTrip(trip.id)}
                    isDeleting={busyId === trip.id}
                    confirmDelete={confirmId === trip.id}
                    onRequestDelete={() => setConfirmId(trip.id)}
                    onCancelDelete={() => setConfirmId(null)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
