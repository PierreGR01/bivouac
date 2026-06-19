import React, { useState, useMemo } from 'react';
import { PoiLocation } from '../types';
import {
  X,
  Droplets,
  Waves,
  Snowflake,
  SunSnow,
  Check,
  AlertCircle,
  MapPin,
  Shield,
  AlertTriangle,
  Mountain,
  Tent,
  Star,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ProtectedArea, findAreasContainingPoint, getProtectedAreaInfo } from '../services/protected-areas';
import { CustomZone, getZoneRestrictionStatus, formatZoneConstraints } from '../../utils/supabase/custom-zones-api';
import { useAuth } from '../contexts/AuthContext';
import * as api from '../../utils/supabase/api';
import { Panel } from './ui/bivouac-panel';
import { BivouacButton } from './ui/bivouac-button';

interface PoiDetailsPanelProps {
  location: PoiLocation | null;
  onClose: () => void;
  protectedAreas?: ProtectedArea[];
  customZones?: CustomZone[];
}

function safeHref(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:' ? url : undefined;
  } catch {
    return undefined;
  }
}

export function PoiDetailsPanel({
  location,
  onClose,
  protectedAreas = [],
  customZones = [],
}: PoiDetailsPanelProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const { isAdmin } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!location) return null;

  const areasContainingPoi = useMemo(() => {
    if (!location || protectedAreas.length === 0) return [];
    return findAreasContainingPoint(
      { lat: location.position.lat, lng: location.position.lng },
      protectedAreas
    );
  }, [location, protectedAreas]);

  const customZoneStatus = useMemo(() => {
    if (!location) return { blocked: [], warnings: [] };
    return getZoneRestrictionStatus(
      { lat: location.position.lat, lng: location.position.lng },
      customZones
    );
  }, [location, customZones]);

  const handleDeletePoi = async () => {
    setIsDeleting(true);
    try {
      await api.deletePoi(location.id);
      alert('Spot supprimé avec succès');
      onClose();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression du spot');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const adminFooter = isAdmin ? (
    showDeleteConfirm ? (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
        <p className="text-sm text-red-800 font-medium mb-3">
          Êtes-vous sûr de vouloir supprimer ce spot ?
        </p>
        <div className="flex gap-3">
          <BivouacButton
            variant="destructive"
            icon={isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            onClick={handleDeletePoi}
            disabled={isDeleting}
            className="flex-1"
          >
            {isDeleting ? 'Suppression…' : 'Confirmer'}
          </BivouacButton>
          <BivouacButton
            variant="outline"
            onClick={() => setShowDeleteConfirm(false)}
            disabled={isDeleting}
            className="flex-1"
          >
            Annuler
          </BivouacButton>
        </div>
      </div>
    ) : (
      <BivouacButton
        variant="destructive"
        icon={<Trash2 className="w-4 h-4" />}
        onClick={() => setShowDeleteConfirm(true)}
        className="w-full bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 py-2.5"
      >
        Supprimer ce spot
      </BivouacButton>
    )
  ) : undefined;

  return (
    <>
      {/* Photo modal (mobile only) */}
      {isPhotoModalOpen && location.photos && location.photos.length > 0 && (
        <div
          className="md:hidden fixed inset-0 bg-black z-[1100] flex items-center justify-center"
          onClick={() => setIsPhotoModalOpen(false)}
        >
          <button
            onClick={() => setIsPhotoModalOpen(false)}
            className="absolute top-4 right-4 p-2 bg-white/90 rounded-full hover:bg-white transition-colors z-10"
          >
            <X className="w-6 h-6 text-gray-800" />
          </button>
          <img
            src={location.photos[currentPhotoIndex]}
            alt={location.title}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {location.photos.length > 1 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
              {location.photos.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentPhotoIndex(index);
                  }}
                  className={`h-2 rounded-full transition-all ${
                    index === currentPhotoIndex
                      ? 'bg-white w-6'
                      : 'bg-white/50 w-2 hover:bg-white/75'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Panel onClose={onClose} title={location.title} mobileMaxHeight="min(66.67dvh, calc(100dvh - 220px))" stickyFooter={adminFooter}>
        <PanelContent
          location={location}
          currentPhotoIndex={currentPhotoIndex}
          setCurrentPhotoIndex={setCurrentPhotoIndex}
          areasContainingPoi={areasContainingPoi}
          customZoneStatus={customZoneStatus}
          onPhotoClick={() => setIsPhotoModalOpen(true)}
        />
      </Panel>
    </>
  );
}

function getSeasonIcon(season: string) {
  if (season === 'hiver') return <Snowflake className="w-3.5 h-3.5" />;
  return <SunSnow className="w-3.5 h-3.5" />;
}

function getSeasonLabel(season: string) {
  if (season === 'hiver') return 'hiver';
  return 'toute saison';
}

function getSeasonStyle(season: string) {
  if (season === 'hiver') return 'bg-blue-100 text-blue-900';
  return 'bg-amber-100 text-amber-800';
}

function PanelContent({
  location,
  currentPhotoIndex,
  setCurrentPhotoIndex,
  areasContainingPoi = [],
  customZoneStatus = { blocked: [], warnings: [] },
  onPhotoClick,
}: {
  location: PoiLocation;
  currentPhotoIndex: number;
  setCurrentPhotoIndex: (index: number) => void;
  areasContainingPoi?: ProtectedArea[];
  customZoneStatus?: { blocked: CustomZone[]; warnings: CustomZone[] };
  onPhotoClick?: () => void;
}) {
  const { isAdmin } = useAuth();
  const [newRating, setNewRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const [visibleReviewCount, setVisibleReviewCount] = useState(10);
  const [localReviews, setLocalReviews] = useState<{ rating: number; comment: string; createdAt?: string }[]>(location.reviews || []);
  const [copiedGps, setCopiedGps] = useState(false);

  const handleCopyGps = () => {
    const coords = `${location.position.lat.toFixed(4)}, ${location.position.lng.toFixed(4)}`;
    navigator.clipboard.writeText(coords).then(() => {
      setCopiedGps(true);
      setTimeout(() => setCopiedGps(false), 2000);
    });
  };

  const sortedReviews = useMemo(() =>
    [...localReviews].sort((a, b) =>
      (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    ), [localReviews]);

  const averageRating = useMemo(() => {
    if (localReviews.length === 0) return 0;
    return localReviews.reduce((acc, r) => acc + r.rating, 0) / localReviews.length;
  }, [localReviews]);

  const hasExistingRatings = localReviews.length > 0;

  const formatReviewDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
  };

  const handleDeleteReview = async (createdAt?: string) => {
    if (!createdAt || !isAdmin) return;
    try {
      const updatedPoi = await api.deleteReview(location.id, createdAt);
      if (updatedPoi?.reviews !== undefined) setLocalReviews(updatedPoi.reviews);
      else setLocalReviews(localReviews.filter(r => r.createdAt !== createdAt));
    } catch (error) {
      console.error('Erreur suppression avis:', error);
    }
  };

  const isCommentValid = reviewComment.trim().split(/\s+/).filter(Boolean).length >= 3;
  const canSubmit = newRating > 0 && isCommentValid;

  const handleSubmitRating = async () => {
    if (!canSubmit) return;
    setIsSubmittingRating(true);
    try {
      const updatedPoi = await api.addRating(location.id, newRating, reviewComment.trim());
      if (updatedPoi?.reviews) {
        setLocalReviews(updatedPoi.reviews);
      } else {
        setLocalReviews([...localReviews, { rating: newRating, comment: reviewComment.trim() }]);
      }
      setNewRating(0);
      setReviewComment('');
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la note:', error);
      setLocalReviews([...localReviews, { rating: newRating, comment: reviewComment.trim() }]);
      setNewRating(0);
      setReviewComment('');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  return (
    <>
      {/* Photo gallery */}
      {location.photos && location.photos.length > 0 && (
        <div className="relative mb-4">
          {/* Mobile: horizontal thumbnails */}
          <div className="flex gap-2 overflow-x-auto pb-2 md:hidden">
            {location.photos.map((photo, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentPhotoIndex(index);
                  onPhotoClick?.();
                }}
                className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                  index === currentPhotoIndex
                    ? 'border-emerald-500'
                    : 'border-transparent hover:border-gray-300'
                }`}
                style={{ height: '35px', width: '52px' }}
              >
                <img
                  src={photo}
                  alt={`${location.title} - Photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>

          {/* Desktop: full image */}
          <div className="hidden md:block">
            <div className="aspect-video bg-gray-200 rounded-xl overflow-hidden">
              <img
                src={location.photos[currentPhotoIndex]}
                alt={location.title}
                className="w-full h-full object-cover"
              />
            </div>
            {location.photos.length > 1 && (
              <div className="flex justify-center gap-2 mt-3">
                {location.photos.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPhotoIndex(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === currentPhotoIndex
                        ? 'bg-emerald-500 w-6'
                        : 'bg-gray-300 w-2 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tags GPS + Altitude + Saison */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button
          onClick={handleCopyGps}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium flex-shrink-0 hover:bg-gray-200 transition-colors cursor-pointer"
          title="Copier les coordonnées"
        >
          {copiedGps ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <MapPin className="w-3.5 h-3.5" />}
          <span>
            {copiedGps
              ? 'Copié !'
              : `${location.position.lat.toFixed(4)}°N, ${location.position.lng.toFixed(4)}°E`}
          </span>
        </button>

        {location.altitude !== undefined && location.altitude !== null && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium flex-shrink-0">
            <Mountain className="w-3.5 h-3.5" />
            <span>{location.altitude} m</span>
          </div>
        )}

        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${getSeasonStyle(location.season)}`}>
          {getSeasonIcon(location.season)}
          <span>{getSeasonLabel(location.season)}</span>
        </div>
      </div>

      {/* Tags eau */}
      <div className="flex flex-nowrap gap-1.5 mb-3 overflow-x-auto">
        {location.waterProximity ? (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${
              location.waterProximity === 'proche'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-sky-50 text-sky-700'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" />
            <span>
              {location.waterProximity === 'proche'
                ? 'Eau très proche'
                : 'Eau à proximité'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-gray-500 text-xs flex-shrink-0">
            <Droplets className="w-3.5 h-3.5" />
            <span>Pas de point d'eau</span>
          </div>
        )}

        {location.naturalWaterProximity === 'proche' ? (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-teal-50 text-teal-700 flex-shrink-0">
            <Waves className="w-3.5 h-3.5" />
            <span>torrent/lac à proximité</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-gray-500 text-xs flex-shrink-0">
            <Waves className="w-3.5 h-3.5" />
            <span>pas de torrent/lac</span>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</h3>
        <p className="text-gray-700 leading-relaxed text-sm">{location.description}</p>
      </div>

      {/* Détails */}
      {(location.capacity || (location.difficulty !== undefined && location.difficulty !== null)) && (
      <div className="mb-4 bg-gray-50 rounded-lg p-3">
        <div className="grid grid-cols-2 gap-3">
          {location.capacity && (
            <div className="flex items-start gap-2">
              <Tent className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Capacité</span>
                <p className="text-sm text-gray-700">
                  {location.capacity === '1' && '1 tente'}
                  {location.capacity === '2-3' && '2–3 tentes'}
                  {location.capacity === '4-5' && '4–5 tentes'}
                  {location.capacity === '5+' && 'Plus de 5 tentes'}
                </p>
              </div>
            </div>
          )}
          {location.difficulty !== undefined && location.difficulty !== null && (
            <div className="flex items-start gap-2">
              <Mountain className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Difficulté</span>
                <div className="flex items-center gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map((level) => {
                    const color =
                      level === 1 ? 'bg-green-500'
                      : level === 2 ? 'bg-lime-500'
                      : level === 3 ? 'bg-yellow-500'
                      : level === 4 ? 'bg-orange-500'
                      : 'bg-red-500';
                    return (
                      <div
                        key={level}
                        className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${
                          location.difficulty && location.difficulty >= level
                            ? `${color} text-white`
                            : 'bg-gray-200 text-gray-400'
                        }`}
                      >
                        {level === location.difficulty ? level : ''}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Zones custom réglementées */}
      {(customZoneStatus.blocked.length > 0 || customZoneStatus.warnings.length > 0) && (
        <div className="mb-4 space-y-3">
          {customZoneStatus.blocked.map(zone => (
            <div key={zone.id} className="border-l-4 border-red-500 bg-red-50 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-sm text-red-900 mb-1">Bivouac interdit</h3>
                  <p className="text-sm text-red-800">{zone.name}</p>
                  {zone.description && (
                    <p className="text-sm text-red-700 mt-1">{zone.description}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {customZoneStatus.warnings.map(zone => (
            <div key={zone.id} className="border-l-4 border-orange-400 bg-orange-50 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-sm text-orange-900 mb-1">Zone réglementée</h3>
                  <p className="text-sm font-medium text-orange-800">{zone.name}</p>
                  <p className="text-sm text-orange-700 mt-1">
                    Bivouac interdit {formatZoneConstraints(zone)}
                  </p>
                  {zone.description && (
                    <p className="text-sm text-orange-700 mt-1">{zone.description}</p>
                  )}
                  {zone.source_url && (
                    <a
                      href={safeHref(zone.source_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 text-sm font-medium underline text-orange-700 hover:text-orange-900"
                    >
                      Plus d'informations →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Zones protégées */}
      {areasContainingPoi.length > 0 && (
        <div className="mb-4 space-y-3">
          {areasContainingPoi.map((area) => {
            const info = getProtectedAreaInfo(area);
            return (
              <div
                key={area.id}
                className={`border-l-4 p-4 rounded-r-lg ${
                  info.isCampingForbidden
                    ? 'bg-red-50 border-red-500'
                    : 'bg-orange-50 border-orange-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  {info.isCampingForbidden ? (
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Shield className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h3
                      className={`font-bold text-sm mb-1 ${
                        info.isCampingForbidden ? 'text-red-900' : 'text-orange-900'
                      }`}
                    >
                      {info.isCampingForbidden ? 'Zone interdite' : 'Zone réglementée'}
                    </h3>
                    <p
                      className={`font-semibold text-sm mb-1 ${
                        info.isCampingForbidden ? 'text-red-800' : 'text-orange-800'
                      }`}
                    >
                      {info.title}
                    </p>
                    {info.description && (
                      <p
                        className={`text-sm mb-2 ${
                          info.isCampingForbidden ? 'text-red-700' : 'text-orange-700'
                        }`}
                      >
                        {info.description}
                      </p>
                    )}
                    {info.restrictions.length > 0 && (
                      <ul className="space-y-1">
                        {info.restrictions.map((restriction, idx) => (
                          <li
                            key={idx}
                            className={`text-sm flex items-start gap-2 ${
                              info.isCampingForbidden ? 'text-red-800' : 'text-orange-800'
                            }`}
                          >
                            <span className="flex-shrink-0">•</span>
                            <span>{restriction}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {safeHref(area.tags.website) && (
                      <a
                        href={safeHref(area.tags.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-block mt-2 text-sm font-medium underline ${
                          info.isCampingForbidden
                            ? 'text-red-700 hover:text-red-900'
                            : 'text-orange-700 hover:text-orange-900'
                        }`}
                      >
                        Plus d'informations →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Réglementation du spot */}
      {location.regulations && (
        <div className="bg-orange-50 border-l-4 border-orange-400 p-3 rounded-r-lg mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-orange-900 mb-1 text-sm">Réglementation</h3>
              <p className="text-sm text-orange-800">{location.regulations}</p>
            </div>
          </div>
        </div>
      )}

      {/* Évaluation */}
      <div className="mb-4 bg-amber-50 rounded-lg p-4">
        {/* Row 1 : titre + étoiles */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Évaluer ce spot</h3>
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-6 h-6 cursor-pointer transition-all ${
                  hoverRating >= star || (!hoverRating && newRating >= star)
                    ? 'fill-yellow-500 text-yellow-500 scale-110'
                    : 'text-gray-300 hover:text-yellow-400'
                }`}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setNewRating(star)}
              />
            ))}
          </div>
        </div>

        {/* Row 2 : champ texte — affiché uniquement après sélection d'une note */}
        {newRating > 0 && (
          <textarea
            className="w-full text-sm rounded-md border border-amber-200 bg-white px-3 py-2 text-gray-700 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-1 focus:ring-amber-400"
            rows={2}
            placeholder="Décrivez votre expérience…"
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
          />
        )}

        {canSubmit && (
          <div className="mt-2">
            <BivouacButton
              variant="primary"
              size="sm"
              onClick={handleSubmitRating}
              disabled={isSubmittingRating}
            >
              {isSubmittingRating ? 'Envoi…' : 'Valider'}
            </BivouacButton>
          </div>
        )}

        {hasExistingRatings && (
          <div className="mt-3 pt-3 border-t border-amber-200">
            {/* Récap moyenne — toujours cliquable */}
            <button
              className="w-full flex items-center gap-2 text-left cursor-pointer bg-white rounded-md px-3 py-2 hover:bg-amber-100 transition-colors"
              onClick={() => setShowReviews((v) => !v)}
            >
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-3.5 h-3.5 ${
                      star <= Math.round(averageRating)
                        ? 'fill-yellow-500 text-yellow-500'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-sm font-semibold text-gray-700">{averageRating.toFixed(1)}/5</span>
              <span className="text-xs text-gray-500">({localReviews.length} avis)</span>
              {showReviews
                ? <ChevronUp className="ml-auto w-4 h-4 text-gray-400" />
                : <ChevronDown className="ml-auto w-4 h-4 text-gray-400" />}
            </button>

            {/* Liste des avis */}
            {showReviews && (
              <div className="flex flex-col gap-1 mt-2">
                {sortedReviews.slice(0, visibleReviewCount).map((review, i) => (
                  <div
                    key={review.createdAt ?? i}
                    className="rounded-md bg-white border border-amber-100 px-3 py-2"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-3 h-3 ${
                                star <= review.rating
                                  ? 'fill-yellow-500 text-yellow-500'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-semibold text-gray-600">{review.rating}/5</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {review.createdAt && (
                          <span className="text-xs text-gray-400">{formatReviewDate(review.createdAt)}</span>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteReview(review.createdAt)}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                            title="Supprimer cet avis"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{review.comment}</p>
                  </div>
                ))}
                {visibleReviewCount < sortedReviews.length && (
                  <button
                    className="mt-1 text-xs text-amber-700 hover:text-amber-900 underline text-left"
                    onClick={() => setVisibleReviewCount((n) => n + 10)}
                  >
                    Montrer plus d'évaluations
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

    </>
  );
}
