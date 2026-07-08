import React, { createContext, useContext, useEffect, useState } from 'react';
import * as authService from '../../utils/supabase/auth';

interface AuthContextType {
  currentUser: authService.AuthUser | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  zoneAdminIds: string[];
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<authService.AuthUser | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [zoneAdminIds, setZoneAdminIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = isSuperAdmin || zoneAdminIds.length > 0;

  async function loadRoles(userId: string) {
    const [adminStatus, zoneIds] = await Promise.all([
      authService.isUserAdmin(userId),
      authService.getZoneAdminIds(userId),
    ]);
    setIsSuperAdmin(adminStatus);
    setZoneAdminIds(zoneIds);
  }

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  async function initializeAuth() {
    setIsLoading(true);
    setError(null);

    try {
      const user = await authService.getCurrentUser();

      if (user) {
        setCurrentUser({
          id: user.id,
          email: user.email || '',
        });

        await loadRoles(user.id);
      } else {
        setCurrentUser(null);
        setIsSuperAdmin(false);
        setZoneAdminIds([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize auth');
      setCurrentUser(null);
      setIsSuperAdmin(false);
      setZoneAdminIds([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, password: string) {
    setError(null);
    setIsLoading(true);

    try {
      const user = await authService.signInWithEmail(email, password);

      if (user) {
        setCurrentUser({
          id: user.id,
          email: user.email || '',
        });

        await loadRoles(user.id);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function signup(email: string, password: string) {
    setError(null);
    setIsLoading(true);

    try {
      const user = await authService.signUpWithEmail(email, password);

      if (user) {
        setCurrentUser({
          id: user.id,
          email: user.email || '',
        });
        setIsSuperAdmin(false);
        setZoneAdminIds([]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Signup failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  async function logout() {
    setError(null);
    setIsLoading(true);

    try {
      await authService.signOut();
      setCurrentUser(null);
      setIsSuperAdmin(false);
      setZoneAdminIds([]);
      authService.removeAuthToken();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Logout failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  const value: AuthContextType = {
    currentUser,
    isAdmin,
    isSuperAdmin,
    zoneAdminIds,
    isLoading,
    error,
    login,
    logout,
    signup,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
