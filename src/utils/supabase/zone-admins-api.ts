import { supabaseClient } from './client';

const EDGE_FUNCTION_URL = import.meta.env.VITE_EDGE_FUNCTION_URL as string;

export interface ZoneAdminGrant {
  id: string;
  adminZoneId: string;
  zoneName: string;
  userId: string;
  email: string;
  createdAt: string;
}

async function getAuthHeader(): Promise<string> {
  const session = await supabaseClient.auth.getSession();
  return `Bearer ${session.data.session?.access_token || ''}`;
}

export async function fetchZoneAdmins(): Promise<ZoneAdminGrant[]> {
  const authHeader = await getAuthHeader();
  const response = await fetch(`${EDGE_FUNCTION_URL}/zone-admins`, {
    method: 'GET',
    headers: { 'Authorization': authHeader },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Failed to fetch zone admins: ${response.statusText}`);
  }
  const data = await response.json();
  return data.data || [];
}

export async function assignZoneAdmin(email: string, adminZoneId: string): Promise<{ invited: boolean }> {
  const authHeader = await getAuthHeader();
  const response = await fetch(`${EDGE_FUNCTION_URL}/zone-admins`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    body: JSON.stringify({ email, adminZoneId }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error || `Failed to assign zone admin: ${response.statusText}`);
  }
  return { invited: !!body?.invited };
}

export async function revokeZoneAdmin(id: string): Promise<void> {
  const authHeader = await getAuthHeader();
  const response = await fetch(`${EDGE_FUNCTION_URL}/zone-admins/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': authHeader },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Failed to revoke zone admin: ${response.statusText}`);
  }
}
