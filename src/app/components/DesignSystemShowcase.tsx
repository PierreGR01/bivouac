/**
 * SHOWCASE DU DESIGN SYSTEM
 * 
 * Composant de démonstration visuelle du design system.
 * À utiliser pour tester et visualiser tous les composants.
 * 
 * Usage: Importer ce composant dans App.tsx temporairement pour voir le showcase
 */

import React from 'react';
import {
  BivouacButton,
  SeasonBadge,
  CountBadge,
  StatusBadge,
  Card,
  InfoCard,
  AlertCard,
  Input,
  Textarea,
  Select,
  Checkbox,
  RangeSlider,
  Panel,
  PanelHeader,
  PanelSection,
  PanelActions,
} from './ui/bivouac-ui';
import {
  Plus,
  Route,
  Trash2,
  Check,
  Tent,
  Droplet,
  Leaf,
  Sun,
  Snowflake,
  Calendar,
  SlidersHorizontal,
  Search,
  AlertCircle,
} from 'lucide-react';

export function DesignSystemShowcase() {
  const [showPanel, setShowPanel] = React.useState(false);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🏕️ Design System Bivouac
          </h1>
          <p className="text-gray-600">
            Showcase complet des composants UI
          </p>
        </div>

        {/* Palette de couleurs */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Palette de couleurs</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Printemps */}
            <div>
              <h3 className="font-semibold mb-3">Printemps / Toute saison</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 rounded-lg bg-emerald-600" />
                  <span className="text-sm">#10b981</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 rounded-lg bg-emerald-700" />
                  <span className="text-sm">#059669</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 rounded-lg bg-emerald-100" />
                  <span className="text-sm">#d1fae5</span>
                </div>
              </div>
            </div>

            {/* Été */}
            <div>
              <h3 className="font-semibold mb-3">Été</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 rounded-lg bg-orange-600" />
                  <span className="text-sm">#ea580c</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 rounded-lg bg-orange-700" />
                  <span className="text-sm">#c2410c</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 rounded-lg bg-orange-100" />
                  <span className="text-sm">#fed7aa</span>
                </div>
              </div>
            </div>

            {/* Hiver */}
            <div>
              <h3 className="font-semibold mb-3">Hiver</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 rounded-lg bg-slate-500" />
                  <span className="text-sm">#64748b</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 rounded-lg bg-slate-600" />
                  <span className="text-sm">#475569</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 rounded-lg bg-slate-200" />
                  <span className="text-sm">#e2e8f0</span>
                </div>
              </div>
            </div>
          </div>

          {/* Couleurs fonctionnelles */}
          <div className="mt-6">
            <h3 className="font-semibold mb-3">Couleurs fonctionnelles</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="w-full h-12 rounded-lg bg-blue-600 mb-2" />
                <p className="text-sm font-medium">Route</p>
                <p className="text-xs text-gray-500">#2563eb</p>
              </div>
              <div>
                <div className="w-full h-12 rounded-lg bg-emerald-600 mb-2" />
                <p className="text-sm font-medium">Success</p>
                <p className="text-xs text-gray-500">#10b981</p>
              </div>
              <div>
                <div className="w-full h-12 rounded-lg bg-amber-500 mb-2" />
                <p className="text-sm font-medium">Warning</p>
                <p className="text-xs text-gray-500">#f59e0b</p>
              </div>
              <div>
                <div className="w-full h-12 rounded-lg bg-red-500 mb-2" />
                <p className="text-sm font-medium">Error</p>
                <p className="text-xs text-gray-500">#ef4444</p>
              </div>
            </div>
          </div>
        </section>

        {/* Boutons */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Boutons</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Variants</p>
              <div className="flex flex-wrap gap-3">
                <BivouacButton variant="primary" icon={<Plus className="w-5 h-5" />}>
                  Primary
                </BivouacButton>
                <BivouacButton variant="secondary" icon={<Route className="w-5 h-5" />}>
                  Secondary
                </BivouacButton>
                <BivouacButton variant="outline">Outline</BivouacButton>
                <BivouacButton variant="destructive" icon={<Trash2 className="w-5 h-5" />}>
                  Destructive
                </BivouacButton>
                <BivouacButton variant="ghost">Ghost</BivouacButton>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Tailles</p>
              <div className="flex flex-wrap items-center gap-3">
                <BivouacButton size="sm">Small</BivouacButton>
                <BivouacButton size="md">Medium</BivouacButton>
                <BivouacButton size="lg">Large</BivouacButton>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">États</p>
              <div className="flex flex-wrap gap-3">
                <BivouacButton>Normal</BivouacButton>
                <BivouacButton disabled>Disabled</BivouacButton>
              </div>
            </div>
          </div>
        </section>

        {/* Badges */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Badges</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Saisons</p>
              <div className="flex flex-wrap gap-2">
                <SeasonBadge season="printemps" icon={<Leaf className="w-3 h-3" />} />
                <SeasonBadge season="été" icon={<Sun className="w-3 h-3" />} />
                <SeasonBadge season="hiver" icon={<Snowflake className="w-3 h-3" />} />
                <SeasonBadge season="toute saison" icon={<Calendar className="w-3 h-3" />} />
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Count Badge</p>
              <div className="flex items-center gap-3">
                <span className="text-sm">Filtres actifs:</span>
                <CountBadge count={3} />
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Status Badges</p>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status="success">Autorisé</StatusBadge>
                <StatusBadge status="warning">Limité</StatusBadge>
                <StatusBadge status="error">Interdit</StatusBadge>
                <StatusBadge status="info">Information</StatusBadge>
              </div>
            </div>
          </div>
        </section>

        {/* Cards */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card standard */}
            <Card>
              <h3 className="font-bold mb-2">Card Standard</h3>
              <p className="text-sm text-gray-600">
                Contenu de la card avec du texte descriptif et des informations.
              </p>
            </Card>

            {/* Info Cards */}
            <div className="grid grid-cols-2 gap-3">
              <InfoCard title="Points" value={5} variant="blue" />
              <InfoCard title="Spots" value={12} variant="emerald" />
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <p className="text-sm font-medium">Alert Cards</p>
            <AlertCard type="success">
              <p className="text-sm font-medium">Succès !</p>
              <p className="text-xs mt-1">Votre action a été réalisée avec succès.</p>
            </AlertCard>
            <AlertCard type="warning">
              <p className="text-sm font-medium">Attention</p>
              <p className="text-xs mt-1">Vérifiez les informations avant de continuer.</p>
            </AlertCard>
            <AlertCard type="info">
              <p className="text-sm">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                Cliquez sur la carte pour placer des points.
              </p>
            </AlertCard>
          </div>
        </section>

        {/* Formulaires */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Formulaires</h2>
          <div className="max-w-2xl space-y-4">
            <Input label="Titre du spot" placeholder="Ex: Bivouac au lac des Chéserys" />

            <Input
              label="Email"
              type="email"
              placeholder="exemple@email.com"
              error="L'email est invalide"
            />

            <Textarea label="Description" placeholder="Décrivez votre spot..." rows={4} />

            <Select
              label="Saison propice"
              options={[
                { value: 'printemps', label: 'Printemps' },
                { value: 'été', label: 'Été' },
                { value: 'hiver', label: 'Hiver' },
                { value: 'toute saison', label: 'Toute saison' },
              ]}
            />

            <Checkbox label="Point d'eau à proximité" />

            <RangeSlider
              label="Distance maximale"
              min={0.5}
              max={10}
              step={0.5}
              value={2}
              unit="km"
              displayValue={2}
            />
          </div>
        </section>

        {/* Panel */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Panel</h2>
          <BivouacButton onClick={() => setShowPanel(true)}>
            Ouvrir le Panel de démonstration
          </BivouacButton>

          {showPanel && (
            <Panel onClose={() => setShowPanel(false)}>
              <PanelHeader
                title="Panel de démonstration"
                icon={<Tent className="w-5 h-5 text-emerald-600" />}
                onClose={() => setShowPanel(false)}
              />

              <PanelSection>
                <AlertCard type="info">
                  <p className="text-sm">
                    Ceci est un exemple de panel responsive. Sur desktop, il apparaît à gauche.
                    Sur mobile, il apparaît en bas.
                  </p>
                </AlertCard>
              </PanelSection>

              <PanelSection>
                <div className="grid grid-cols-2 gap-3">
                  <InfoCard title="Points" value={5} variant="blue" />
                  <InfoCard title="Spots" value={12} variant="emerald" />
                </div>
              </PanelSection>

              <PanelSection>
                <Input label="Champ de saisie" placeholder="Saisir du texte..." />
              </PanelSection>

              <PanelActions>
                <BivouacButton variant="outline" className="flex-1">
                  Annuler
                </BivouacButton>
                <BivouacButton variant="primary" className="flex-1">
                  Valider
                </BivouacButton>
              </PanelActions>
            </Panel>
          )}
        </section>

        {/* Icônes */}
        <section>
          <h2 className="text-2xl font-bold mb-6">Iconographie</h2>
          <p className="text-sm text-gray-600 mb-4">
            Icons depuis Lucide React - Tailles: 16px, 20px, 24px
          </p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-6">
            {[
              { icon: <Tent className="w-6 h-6" />, name: 'Tent' },
              { icon: <Route className="w-6 h-6" />, name: 'Route' },
              { icon: <Plus className="w-6 h-6" />, name: 'Plus' },
              { icon: <Search className="w-6 h-6" />, name: 'Search' },
              { icon: <SlidersHorizontal className="w-6 h-6" />, name: 'Filters' },
              { icon: <Droplet className="w-6 h-6" />, name: 'Water' },
              { icon: <Leaf className="w-6 h-6" />, name: 'Spring' },
              { icon: <Sun className="w-6 h-6" />, name: 'Summer' },
              { icon: <Snowflake className="w-6 h-6" />, name: 'Winter' },
              { icon: <Check className="w-6 h-6" />, name: 'Check' },
              { icon: <Trash2 className="w-6 h-6" />, name: 'Delete' },
              { icon: <AlertCircle className="w-6 h-6" />, name: 'Alert' },
            ].map((item) => (
              <div key={item.name} className="text-center">
                <div className="flex items-center justify-center h-12 text-gray-700">
                  {item.icon}
                </div>
                <p className="text-xs text-gray-500 mt-1">{item.name}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center text-sm text-gray-500 pt-8 border-t">
          <p>Design System Bivouac - Version 1.0</p>
          <p className="mt-1">
            Consultez <code className="bg-gray-200 px-2 py-1 rounded">/DESIGN_SYSTEM.md</code>{' '}
            pour la documentation complète
          </p>
        </footer>
      </div>
    </div>
  );
}
