import { http, HttpResponse } from 'msw';
import { useAuthStore, type SessionUser } from '@/shared/store/auth';
import type { UserRole } from '@/shared/auth/permissions';
import { API_URL } from './handlers/inventory';

export function makeUser(role: UserRole): SessionUser {
  return { id: `user-${role}`, name: `Usuário ${role}`, email: `${role.toLowerCase()}@example.com`, role };
}

/** Starts an authenticated session in the store (token encodes the role for the /users/me handler). */
export function loginAs(role: UserRole) {
  localStorage.setItem('token', `token-${role}`);
  useAuthStore.setState({ token: `token-${role}`, user: makeUser(role), sessionExpired: false });
}

export function resetSession() {
  localStorage.removeItem('token');
  useAuthStore.setState({ token: null, user: null, sessionExpired: false });
}

export const authHandlers = [
  http.get(`${API_URL}/users/me`, ({ request }) => {
    const role = (request.headers.get('authorization') ?? '').replace('Bearer token-', '') as UserRole;
    return HttpResponse.json({ data: { ...makeUser(role), active: true, createdAt: '2026-10-23T12:00:00.000Z' } });
  }),
];
