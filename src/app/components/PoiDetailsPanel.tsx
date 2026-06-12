import React, { useState, useMemo } from 'react';
import { PoiLocation } from '../types';
import {
  X,
  Droplets,
  Waves,
  Snowflake,
  Sun,
  AlertCircle,
  MapPin,
  Shield,
  AlertTriangle,
  Mountain,
  Tent,
  Star,
  Trash2,
  Loader2,
} from 'lucide-react';
import { ProtectedArea, findAreasContainingPoint, getProtectedAreaInfo } from '../services/protected-areas';
import { CustomZone, getZoneRestrictionStatus, formatZoneConstraints } from '../../utils/supabase/custom-zones-api';
import { useAuth } from '../contexts/AuthContext';
import * as api from '/utils/supabase/api';
import { Panel } from './ui/bivouac-panel';
import { BivouacButton } from './ui/bivouac-button';

interface PoiDetailsPanelProps {
  location: PoiLocation | null;
  onClose: () => void;
  protectedAreas?: ProtectedArea[];
  customZones?: CustomZone[];
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
  if (season === 'hiver') return <Snowflake className="w-4 h-4" />;
  return <Sun className="w-4 h-4" />;
}

function getSeasonStyle(season: string) {
  if (season === 'hiver') return 'bg-slate-100 text-slate-700';
  if (season === 'été') return 'bg-orange-100 text-orange-700';
  return 'bg-amber-50 text-amber-700';
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
  const [newRating, setNewRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [localRatings, setLocalRatings] = useState<number[]>(location.ratings || []);

  const averageRating = useMemo(() => {
    if (!localRatings || localRatings.length === 0) return 0;
    return localRatings.reduce((acc, r) => acc + r, 0) / localRatings.length;
  }, [localRatings]);

  const handleSubmitRating = async () => {
    if (newRating === 0) return;
    setIsSubmittingRating(true);
    try {
      const updatedPoi = await api.addRating(location.id, newRating);
      if (updatedPoi && updatedPoi.ratings) {
        setLocalRatings(updatedPoi.ratings);
        setNewRating(0);
        alert(`Note de ${newRating}/5 ajoutée avec succès !`);
      } else {
        setLocalRatings([...localRatings, newRating]);
        setNewRating(0);
        alert(`Note de ${newRating}/5 ajoutée localement.`);
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la note:', error);
      setLocalRatings([...localRatings, newRating]);
      setNewRating(0);
      alert(`Note de ${newRating}/5 ajoutée localement.`);
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

      {/* Localisation */}
      <div className="flex items-center gap-2 text-gray-500 mb-3">
        <MapPin className="w-4 h-4 flex-shrink-0" />
        <span className="text-xs break-all">
          {location.position.lat.toFixed(4)}°N, {location.position.lng.toFixed(4)}°E
        </span>
      </div>

      {/* Badges */}
      <div className="flex flex-nowrap gap-1.5 mb-3 overflow-x-auto">
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${getSeasonStyle(location.season)}`}>
          {getSeasonIcon(location.season)}
          <span className="capitalize">{location.season}</span>
        </div>

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
      <div className="mb-4 bg-gray-50 rounded-lg p-3">
        {location.altitude !== undefined && location.altitude !== null && (
          <div className="flex items-center gap-3 mb-3">
            <Mountain className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Altitude</span>
              <p className="text-sm text-gray-700">{location.altitude}m</p>
            </div>
          </div>
        )}
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
                      href={zone.source_url}
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
                    {area.tags.website && (
                      <a
                        href={area.tags.website}
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
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Évaluation</h3>

        {localRatings.length > 0 ? (
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${
                    star <= Math.round(averageRating)
                      ? 'fill-yellow-500 text-yellow-500'
                      : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm font-semibold text-gray-700">
              {averageRating.toFixed(1)}/5
            </span>
            <span className="text-xs text-gray-500">({localRatings.length} avis)</span>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-4">Aucune évaluation pour le moment</p>
        )}

        <div className="border-t border-amber-200 pt-3">
          <p className="text-sm font-medium text-gray-700 mb-2">Notez ce spot :</p>
          <div className="flex items-center gap-3">
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
            {newRating > 0 && (
              <BivouacButton
                variant="primary"
                size="sm"
                onClick={handleSubmitRating}
                disabled={isSubmittingRating}
              >
                {isSubmittingRating ? 'Envoi…' : 'Valider'}
              </BivouacButton>
            )}
          </div>
        </div>
      </div>

    </>
  );
}
