import { supabaseClient } from './client';

const EDGE_FUNCTION_URL = import.meta.env.VITE_EDGE_FUNCTION_URL as string;

export interface AdminUserSummary {
  id: string;
  email: string;
  createdAt: string;
  spotsCount: number;
  reviewsCount: number;
}

async function getAuthHeader(): Promise<string> {
  const session = await supabaseClient.auth.getSession();
  return `Bearer ${session.data.session?.access_token || ''}`;
}

export async function fetchUsers(): Promise<AdminUserSummary[]> {
  const authHeader = await getAuthHeader();
  const response = await fetch(`${EDGE_FUNCTION_URL}/users`, {
    method: 'GET',
    headers: { 'Authorization': authHeader },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Failed to fetch users: ${response.statusText}`);
  }
  const data = await response.json();
  return data.data || [];
}

export async function fetchAuthorEmails(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const authHeader = await getAuthHeader();
  const response = await fetch(`${EDGE_FUNCTION_URL}/users/emails`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: JSON.stringify({ ids }),
  });
  if (!response.ok) return {};
  const data = await response.json();
  return data.data || {};
}

export async function deleteUser(id: string, options: { deleteSpots: boolean; deleteReviews: boolean }): Promise<void> {
  const authHeader = await getAuthHeader();
  const response = await fetch(`${EDGE_FUNCTION_URL}/users/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: JSON.stringify(options),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Failed to delete user: ${response.statusText}`);
  }
}
