import React from 'react';
import { ShieldAlert, ExternalLink, Clock, Calendar, Volume2, Radio, Trash2, Droplets } from 'lucide-react';
import { Panel } from './ui/bivouac-panel';
import { CustomZone } from '../../utils/supabase/custom-zones-api';
import { ProtectedArea, getProtectedAreaInfo } from '../services/protected-areas';

interface ZoneInfoPanelProps {
  zone: CustomZone | null;
  protectedArea: ProtectedArea | null;
  onClose: () => void;
}

const restrictionLabels: Record<string, string> = {
  camping_forbidden: 'Camping interdit',
  bivouac_forbidden: 'Bivouac interdit',
  fire_forbidden: 'Tout type de feux interdits',
};

function osmRestrictionTypes(area: ProtectedArea): string[] {
  const tags = area.tags || {};
  const hasBivouacTag = tags.bivouac === 'no' || tags.bivouac === 'forbidden';
  const hasCampingTag = tags.camping === 'no' || tags.camping === 'forbidden';

  if (area.protectionLevel === 'strict') {
    return ['camping_forbidden', 'bivouac_forbidden'];
  }
  if (hasBivouacTag || hasCampingTag) {
    return hasBivouacTag
      ? ['camping_forbidden', 'bivouac_forbidden']
      : ['camping_forbidden'];
  }
  return ['camping_forbidden'];
}

interface RestrictionDisplayProps {
  restrictionTypes: string[];
  timeRangeStart?: string | null;
  timeRangeEnd?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
}

function RestrictionDisplay({
  restrictionTypes,
  timeRangeStart,
  timeRangeEnd,
  periodStart,
  periodEnd,
}: RestrictionDisplayProps) {
  if (restrictionTypes.length === 0) return null;

  const hasTimeRestriction = !!(timeRangeStart && timeRangeEnd);
  const hasPeriodRestriction = !!(periodStart && periodEnd);
  const hasTemporalRestriction = hasTimeRestriction || hasPeriodRestriction;
  const hasFire = restrictionTypes.includes('fire_forbidden');
  const conditionalTypes = restrictionTypes.filter(t => t !== 'fire_forbidden');
  const showSplit = hasTemporalRestriction && conditionalTypes.length > 0;

  if (showSplit) {
    return (
      <div className="mb-4 space-y-3">
        {/* Encart conditionnel */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
            Réglementation saisonnière ou selon l'heure
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {hasTimeRestriction && (
              <span className="inline-flex items-center gap-1.5 text-xs bg-amber-100 text-amber-700 rounded px-2 py-1 font-medium">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                de {timeRangeStart} à {timeRangeEnd}
              </span>
            )}
            {hasPeriodRestriction && (
              <span className="inline-flex items-center gap-1.5 text-xs bg-amber-100 text-amber-700 rounded px-2 py-1 font-medium">
                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                du {periodStart} au {periodEnd}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {conditionalTypes.map(t => (
              <span key={t} className="text-xs bg-red-100 text-red-700 rounded px-2 py-1 font-medium">
                {restrictionLabels[t] ?? t}
              </span>
            ))}
            {hasFire && (
              <span className="text-xs bg-orange-100 text-orange-600 rounded px-2 py-1 font-medium">
                Réchaud toléré
              </span>
            )}
          </div>
        </div>

        {/* Encart permanent */}
        {hasFire && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Toujours applicable
            </p>
            <span className="text-xs bg-red-100 text-red-700 rounded px-2 py-1 font-medium">
              {restrictionLabels['fire_forbidden']}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mb-4">
      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Réglementation</p>
      <div className="flex flex-wrap gap-1.5">
        {restrictionTypes.map(t => (
          <span key={t} className="text-xs bg-red-100 text-red-700 rounded px-2 py-1">
            {restrictionLabels[t] ?? t}
          </span>
        ))}
      </div>
      {hasTimeRestriction && (
        <div className="flex items-center gap-2 mt-2">
          <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-600">{timeRangeStart} – {timeRangeEnd}</span>
        </div>
      )}
      {hasPeriodRestriction && (
        <div className="flex items-center gap-2 mt-1">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-600">du {periodStart} au {periodEnd}</span>
        </div>
      )}
    </div>
  );
}

function ClassicRegulations() {
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Règles communes</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        <span className="inline-flex items-center gap-1.5 text-xs bg-orange-50 text-orange-700 border border-orange-100 rounded px-2 py-1 font-medium">
          <Volume2 className="w-3.5 h-3.5 flex-shrink-0" />
          Pas de bruit excessif
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs bg-orange-50 text-orange-700 border border-orange-100 rounded px-2 py-1 font-medium">
          <Radio className="w-3.5 h-3.5 flex-shrink-0" />
          Enceintes interdites
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs bg-orange-50 text-orange-700 border border-orange-100 rounded px-2 py-1 font-medium">
          <Trash2 className="w-3.5 h-3.5 flex-shrink-0" />
          Redescendre ses déchets
        </span>
      </div>
      <div className="flex items-start gap-2 text-sm text-gray-500">
        <Droplets className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
        <span>Eaux usées (toilette, vaisselle, lessive…) à plus de 50 m de tout point d'eau</span>
      </div>
    </div>
  );
}

export function ZoneInfoPanel({ zone, protectedArea, onClose }: ZoneInfoPanelProps) {
  if (!zone && !protectedArea) return null;

  if (zone) {
    const types = zone.restriction_types ?? [];
    const iconColor = types.includes('bivouac_forbidden')
      ? 'text-red-600'
      : types.includes('camping_forbidden')
        ? 'text-orange-600'
        : 'text-yellow-600';

    return (
      <Panel
        onClose={onClose}
        title={zone.name}
        icon={<ShieldAlert className={`w-5 h-5 ${iconColor}`} />}
      >
        {zone.description && (
          <p className="text-sm text-gray-600 mb-4">{zone.description}</p>
        )}
        <RestrictionDisplay
          restrictionTypes={types}
          timeRangeStart={zone.time_range_start}
          timeRangeEnd={zone.time_range_end}
          periodStart={zone.period_start}
          periodEnd={zone.period_end}
        />
        <ClassicRegulations />
        {zone.source_url && (
          <a
            href={zone.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700"
          >
            <ExternalLink className="w-4 h-4" />
            Source officielle
          </a>
        )}
      </Panel>
    );
  }

  const info = getProtectedAreaInfo(protectedArea!);
  const types = osmRestrictionTypes(protectedArea!);
  const iconColor = protectedArea!.protectionLevel === 'strict' ? 'text-red-600' : 'text-orange-600';

  return (
    <Panel
      onClose={onClose}
      title={info.title}
      icon={<ShieldAlert className={`w-5 h-5 ${iconColor}`} />}
    >
      {info.description && (
        <p className="text-sm text-gray-600 mb-4">{info.description}</p>
      )}
      <RestrictionDisplay restrictionTypes={types} />
      <ClassicRegulations />
      {protectedArea!.tags.website && (
        <a
          href={protectedArea!.tags.website}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700"
        >
          <ExternalLink className="w-4 h-4" />
          Plus d'infos
        </a>
      )}
      <p className="mt-4 text-xs text-gray-400">Source : OpenStreetMap</p>
    </Panel>
  );
}
