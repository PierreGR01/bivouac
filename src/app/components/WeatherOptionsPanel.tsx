import { Wind, CloudLightning, Thermometer } from 'lucide-react';
import { Switch } from './ui/switch';

interface WeatherOptionsPanelProps {
  showWind: boolean;
  onWindToggle: () => void;
  showStorms: boolean;
  onStormsToggle: () => void;
  showNivoses: boolean;
  onNivosesToggle: () => void;
}

export function WeatherOptionsPanel({
  showWind,
  onWindToggle,
  showStorms,
  onStormsToggle,
  showNivoses,
  onNivosesToggle,
}: WeatherOptionsPanelProps) {
  const rows = [
    { key: 'wind', label: 'Vent', icon: Wind, checked: showWind, onToggle: onWindToggle },
    { key: 'storms', label: 'Orages + précipitations', icon: CloudLightning, checked: showStorms, onToggle: onStormsToggle },
    { key: 'nivoses', label: 'Nivoses', icon: Thermometer, checked: showNivoses, onToggle: onNivosesToggle },
  ];

  return (
    <div className="bg-white rounded-xl shadow-xl p-2 w-56">
      <div className="text-xs font-semibold text-gray-500 px-2 pt-1 pb-2">Couches météo</div>
      <div className="flex flex-col gap-1">
        {rows.map(({ key, label, icon: Icon, checked, onToggle }) => (
          <div
            key={key}
            onClick={onToggle}
            className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <span className="flex items-center gap-2 text-sm text-gray-700">
              <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
              {label}
            </span>
            <Switch checked={checked} onCheckedChange={onToggle} onClick={(e) => e.stopPropagation()} />
          </div>
        ))}
      </div>
    </div>
  );
}
