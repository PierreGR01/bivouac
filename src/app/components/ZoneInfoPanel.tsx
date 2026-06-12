import React from 'react';
import { ShieldAlert, ExternalLink, Clock, Calendar } from 'lucide-react';
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
  fire_forbidden: 'Feu interdit',
};

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
        {types.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Réglementation</p>
            <div className="flex flex-wrap gap-1.5">
              {types.map(t => (
                <span key={t} className="text-xs bg-red-100 text-red-700 rounded px-2 py-1">
                  {restrictionLabels[t] ?? t}
                </span>
              ))}
            </div>
          </div>
        )}
        {zone.time_range_start && zone.time_range_end && (
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span>De {zone.time_range_start} à {zone.time_range_end}</span>
          </div>
        )}
        {zone.period_start && zone.period_end && (
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span>Du {zone.period_start} au {zone.period_end}</span>
          </div>
        )}
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

  return (
    <Panel
      onClose={onClose}
      title={info.title}
      icon={<ShieldAlert className="w-5 h-5 text-orange-600" />}
    >
      {info.description && (
        <p className="text-sm text-gray-600 mb-4">{info.description}</p>
      )}
      {info.restrictions.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Réglementation</p>
          <ul className="space-y-1.5">
            {info.restrictions.map((r, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
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
