import React, { useState } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Panel } from './ui/bivouac-panel';
import { BivouacButton } from './ui/bivouac-button';
import { Input } from './ui/bivouac-input';

interface LoginPanelProps {
  onClose: () => void;
}

export function LoginPanel({ onClose }: LoginPanelProps) {
  const { currentUser, isAdmin, login, logout, isLoading, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      await login(email, password);
      setEmail('');
      setPassword('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Échec de la connexion');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setEmail('');
      setPassword('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Échec de la déconnexion');
    }
  };

  const title = currentUser ? 'Mon compte' : 'Connexion admin';

  return (
    <Panel onClose={onClose} title={title}>
      {currentUser ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Email :</span> {currentUser.email}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Statut :</span>{' '}
              {isAdmin ? (
                <span className="text-emerald-700 font-semibold">Admin</span>
              ) : (
                <span className="text-gray-500">Utilisateur</span>
              )}
            </p>
          </div>
          <BivouacButton
            variant="destructive"
            size="lg"
            icon={<LogOut size={18} />}
            onClick={handleLogout}
            disabled={isLoading}
            className="w-full"
          >
            Se déconnecter
          </BivouacButton>
        </div>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            className="py-2.5"
            disabled={isLoading}
            autoComplete="email"
          />
          <Input
            label="Mot de passe"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="py-2.5"
            disabled={isLoading}
            autoComplete="current-password"
          />
          {(error || localError) && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error || localError}
            </div>
          )}
          <BivouacButton
            type="submit"
            variant="primary"
            size="lg"
            icon={<LogIn size={18} />}
            disabled={isLoading || !email || !password}
            className="w-full"
          >
            {isLoading ? 'Connexion…' : 'Se connecter'}
          </BivouacButton>
          <p className="text-xs text-gray-400 text-center">Accès administrateur uniquement.</p>
        </form>
      )}
    </Panel>
  );
}
