import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Trash2, UserPlus, ShieldCheck, Pencil, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Panel } from './ui/bivouac-panel';
import { BivouacButton } from './ui/bivouac-button';
import { Input } from './ui/bivouac-input';
import { useAuth } from '../contexts/AuthContext';
import { fetchAdminZones, AdminZone } from '../../utils/supabase/admin-zones-api';
import { fetchZoneAdmins, assignZoneAdmin, revokeZoneAdmin, ZoneAdminGrant } from '../../utils/supabase/zone-admins-api';

interface AdminZonesManagerProps {
  onClose?: () => void;
  onCreateNew: () => void;
  onEditZone: (zone: AdminZone) => void;
  // Rendu inline dans le dashboard admin (sans le chrome Panel ni bouton fermer) plutôt
  // qu'en panneau flottant indépendant.
  embedded?: boolean;
  // Le dashboard admin affiche désormais ce bouton lui-même, à côté de "Créer une zone
  // réglementée" et sous le libellé "Attribuer la gestion d'un territoire" — on masque
  // donc le bouton interne pour éviter le doublon.
  showCreateButton?: boolean;
}

export function AdminZonesManager({ onClose, onCreateNew, onEditZone, embedded = false, showCreateButton = true }: AdminZonesManagerProps) {
  const { isSuperAdmin } = useAuth();
  const [zones, setZones] = useState<AdminZone[]>([]);
  const [grants, setGrants] = useState<ZoneAdminGrant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [zonesData, grantsData] = await Promise.all([
        fetchAdminZones(),
        fetchZoneAdmins(),
      ]);
      setZones(zonesData);
      setGrants(grantsData);
    } catch (error) {
      console.error('Error loading admin zones data:', error);
      toast.error('Impossible de charger les territoires');
    } finally {
      setIsLoading(false);
    }
  }

  if (!isSuperAdmin) return null;

  const handleToggleExpand = (zoneId: string) => {
    setExpandedZoneId((prev) => (prev === zoneId ? null : zoneId));
    setEmail('');
  };

  const handleAssign = async (zoneId: string) => {
    if (!email.trim()) return;
    setIsSubmitting(true);
    try {
      const { invited } = await assignZoneAdmin(email.trim(), zoneId);
      toast.success(invited ? 'Invitation envoyée par email' : 'Administrateur de zone assigné');
      setEmail('');
      await loadData();
    } catch (error) {
      console.error('Error assigning zone admin:', error);
      toast.error(error instanceof Error ? error.message : 'Échec de l\'assignation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await revokeZoneAdmin(id);
      setGrants((prev) => prev.filter((g) => g.id !== id));
      toast.success('Attribution révoquée');
    } catch (error) {
      console.error('Error revoking zone admin:', error);
      toast.error('Échec de la révocation');
    } finally {
      setRevokingId(null);
    }
  };

  const content = (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        </div>
      ) : (
        <>
          {showCreateButton && (
            <BivouacButton
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={onCreateNew}
              className="w-full mb-4"
            >
              Nouveau territoire
            </BivouacButton>
          )}

          {zones.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun territoire pour le moment.</p>
          ) : (
            <div className="space-y-2">
              {zones.map((zone) => {
                const zoneGrants = grants.filter((g) => g.adminZoneId === zone.id);
                const expanded = expandedZoneId === zone.id;
                return (
                  <div key={zone.id} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
                      <button
                        onClick={() => handleToggleExpand(zone.id)}
                        className="flex-1 flex items-center justify-between gap-2 min-w-0 text-left"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{zone.name}</p>
                          <p className="text-xs text-gray-500">
                            {zoneGrants.length} admin{zoneGrants.length !== 1 ? 's' : ''} de zone
                          </p>
                        </div>
                        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                      </button>
                      <button
                        onClick={() => onEditZone(zone)}
                        className="flex-shrink-0 p-1.5 text-gray-400 hover:text-emerald-600 transition-colors"
                        title="Modifier le tracé"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>

                    {expanded && (
                      <div className="p-3 space-y-3 border-t border-gray-100">
                        {zoneGrants.length > 0 && (
                          <div className="space-y-1.5">
                            {zoneGrants.map((grant) => (
                              <div key={grant.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
                                <span className="text-sm text-gray-700 truncate">{grant.email}</span>
                                <button
                                  onClick={() => handleRevoke(grant.id)}
                                  disabled={revokingId === grant.id}
                                  className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                                  title="Révoquer"
                                >
                                  {revokingId === grant.id
                                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    : <Trash2 className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Input
                            type="email"
                            placeholder="utilisateur@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="text-sm px-3 py-1.5"
                          />
                          <BivouacButton
                            variant="primary"
                            size="sm"
                            icon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                            onClick={() => handleAssign(zone.id)}
                            disabled={isSubmitting || !email.trim()}
                            className="flex-shrink-0"
                          >
                            Assigner
                          </BivouacButton>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );

  if (embedded) return content;

  return (
    <Panel onClose={onClose ?? (() => {})} title="Zones d'administration" icon={<ShieldCheck className="w-5 h-5" />}>
      {content}
    </Panel>
  );
}
