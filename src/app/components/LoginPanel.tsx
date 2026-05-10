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
      // Don't close panel - let user see they're logged in
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setEmail('');
      setPassword('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Logout failed');
    }
  };

  if (currentUser) {
    return (
      <div className="fixed bottom-4 right-4 w-96 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50" style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 9999, backgroundColor: 'white', width: '384px' }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">User Info</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          <p className="text-sm text-gray-600">
            <strong>Email:</strong> {currentUser.email}
          </p>
          <p className="text-sm text-gray-600">
            <strong>Status:</strong>{' '}
            {isAdmin ? (
              <span className="text-red-600 font-bold">Admin</span>
            ) : (
              <span className="text-gray-600">User</span>
            )}
          </p>
        </div>

        <button
          onClick={handleLogout}
          disabled={isLoading}
          className="w-full bg-red-500 text-white py-2 rounded-md hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50" style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 9999, backgroundColor: 'white', width: '384px' }}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Admin Login</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleLogin} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>

        {(error || localError) && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
            {error || localError}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !email || !password}
          className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
        >
          <LogIn size={18} />
          Login
        </button>
      </form>

      <p className="text-xs text-gray-500 text-center mt-3">
        Admin access only. Contact maintainer for credentials.
      </p>
    </div>
  );
}
