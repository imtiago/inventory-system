import { api } from '@/shared/services/api';
import type { CreateUserInput, UpdateUserInput, UserDTO, UserListResponse } from '../types';

export async function getUsers(page = 1, search = ''): Promise<UserListResponse> {
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set('search', search);

  const response = await api.get(`/users?${params.toString()}`);
  return response.data;
}

export async function createUser(input: CreateUserInput): Promise<UserDTO> {
  const response = await api.post('/users', input);
  return response.data.data;
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<UserDTO> {
  const response = await api.patch(`/users/${id}`, input);
  return response.data.data;
}

export async function resetUserPassword(id: string, password: string): Promise<void> {
  await api.post(`/users/${id}/password`, { password });
}

export async function changeOwnPassword(input: { currentPassword: string; newPassword: string }): Promise<void> {
  await api.put('/users/me/password', input);
}
