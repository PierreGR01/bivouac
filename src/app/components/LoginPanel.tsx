import React, { useState } from 'react';
import { X, LogIn, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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

  const content = currentUser ? (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          <span className="font-medium">Email :</span> {currentUser.email}
        </p>
        <p className="text-sm text-gray-600">
          <span className="font-medium">Statut :</span>{' '}
          {isAdmin ? (
            <span className="text-green-700 font-semibold">Admin</span>
          ) : (
            <span className="text-gray-500">Utilisateur</span>
          )}
        </p>
      </div>
      <button
        onClick={handleLogout}
        disabled={isLoading}
        className="w-full bg-red-500 text-white py-3 rounded-xl hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2 font-medium transition-colors"
      >
        <LogOut size={18} />
        Se déconnecter
      </button>
    </div>
  ) : (
    <form onSubmit={handleLogin} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@example.com"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          disabled={isLoading}
          autoComplete="email"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Mot de passe
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          disabled={isLoading}
          autoComplete="current-password"
        />
      </div>
      {(error || localError) && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error || localError}
        </div>
      )}
      <button
        type="submit"
        disabled={isLoading || !email || !password}
        className="w-full bg-green-600 text-white py-3 rounded-xl hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium transition-colors"
      >
        <LogIn size={18} />
        {isLoading ? 'Connexion…' : 'Se connecter'}
      </button>
      <p className="text-xs text-gray-400 text-center">
        Accès administrateur uniquement.
      </p>
    </form>
  );

  return (
    <>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* Mobile: bottom sheet */}
      <div
        className="md:hidden fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-[1000]"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="px-6 pb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-5">
            {currentUser ? 'Mon compte' : 'Connexion admin'}
          </h2>
          {content}
        </div>
      </div>

      {/* Desktop: left panel below header */}
      <div
        className="hidden md:block fixed top-[158px] left-6 w-[480px] bg-white shadow-2xl z-[500] rounded-b-xl"
        style={{ animation: 'fadeIn 0.3s ease-out' }}
      >
        <div className="flex items-center justify-between px-6 py-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">
            {currentUser ? 'Mon compte' : 'Connexion admin'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-800" />
          </button>
        </div>
        <div className="px-6 py-6">
          {content}
        </div>
      </div>
    </>
  );
}
