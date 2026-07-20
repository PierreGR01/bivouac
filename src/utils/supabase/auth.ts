import { supabaseClient } from './client';

export interface AuthUser {
  id: string;
  email: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.origin,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data.user;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data.user;
}

export async function signOut() {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  return user;
}

export async function updatePassword(newPassword: string) {
  const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

  if (error) {
    throw new Error(error.message);
  }
}

export async function getSession() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  return session;
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabaseClient
    .from('admin_users')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return false;
  }

  return true;
}

// Retourne les IDs des zones d'administration (territoires) que cet utilisateur administre.
export async function getZoneAdminIds(userId: string): Promise<string[]> {
  const { data, error } = await supabaseClient
    .from('zone_admins')
    .select('admin_zone_id')
    .eq('user_id', userId);

  if (error || !data) {
    return [];
  }

  return data.map((row: { admin_zone_id: string }) => row.admin_zone_id);
}

export function getAuthToken() {
  return localStorage.getItem('supabase_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('supabase_token', token);
}

export function removeAuthToken() {
  localStorage.removeItem('supabase_token');
}
