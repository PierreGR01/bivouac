import React, { useState } from 'react';
import { LogIn, LogOut, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Panel } from './ui/bivouac-panel';
import { BivouacButton } from './ui/bivouac-button';
import { Input } from './ui/bivouac-input';

interface LoginPanelProps {
  onClose: () => void;
}

export function LoginPanel({ onClose }: LoginPanelProps) {
  const { currentUser, isSuperAdmin, zoneAdminIds, login, logout, signup, isLoading, error } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    try {
      await signup(email, password);
      setEmail('');
      setPassword('');
      setMode('login');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Échec de l'inscription");
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

  const title = currentUser ? 'Mon compte' : mode === 'signup' ? 'Créer un compte' : 'Connexion';

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
              {isSuperAdmin ? (
                <span className="text-emerald-700 font-semibold">Administrateur</span>
              ) : zoneAdminIds.length > 0 ? (
                <span className="text-emerald-700 font-semibold">Administrateur de zone</span>
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
      ) : mode === 'signup' ? (
        <form onSubmit={handleSignup} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@example.com"
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
            autoComplete="new-password"
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
            icon={<UserPlus size={18} />}
            disabled={isLoading || !email || !password}
            className="w-full"
          >
            {isLoading ? 'Inscription…' : "Finaliser l'inscription"}
          </BivouacButton>
          <button
            type="button"
            onClick={() => { setMode('login'); setLocalError(null); }}
            className="w-full text-sm text-gray-500 hover:text-gray-700 text-center"
          >
            J'ai déjà un compte
          </button>
        </form>
      ) : (
        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@example.com"
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
          <BivouacButton
            type="button"
            variant="secondary"
            size="lg"
            icon={<UserPlus size={18} />}
            onClick={() => { setMode('signup'); setLocalError(null); }}
            disabled={isLoading}
            className="w-full"
          >
            S'inscrire
          </BivouacButton>
        </form>
      )}
    </Panel>
  );
}
