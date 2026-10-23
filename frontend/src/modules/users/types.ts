import type { UserRole } from '@/shared/auth/permissions';

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface UserListResponse {
  data: UserDTO[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  role?: UserRole;
  active?: boolean;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  VENDEDOR: 'Vendedor',
  ESTOQUISTA: 'Estoquista',
};

export const ROLES = Object.keys(ROLE_LABELS) as UserRole[];
