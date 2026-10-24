import { describe, expect, test } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { AppRoutes } from '../AppRoutes';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { loginAs, resetSession } from '@/test/auth';

describe('RouteGuard / AppRoutes', () => {
  test('rota sem permissão → página 403', async () => {
    loginAs('VENDEDOR');
    renderWithProviders(<AppRoutes />, { route: '/inventory/initial' });
    expect(await screen.findByText('Você não tem acesso a esta página.')).toBeInTheDocument();
  });

  test('ESTOQUISTA não acessa vendas; ADMIN acessa', async () => {
    loginAs('ESTOQUISTA');
    const first = renderWithProviders(<AppRoutes />, { route: '/sales' });
    expect(await screen.findByText('Você não tem acesso a esta página.')).toBeInTheDocument();
    first.unmount();

    loginAs('ADMIN');
    renderWithProviders(<AppRoutes />, { route: '/sales' });
    await screen.findByText('Nova Venda');
    expect(screen.queryByText('Você não tem acesso a esta página.')).not.toBeInTheDocument();
  });

  test('sem sessão → /login', async () => {
    resetSession();
    renderWithProviders(<AppRoutes />, { route: '/products' });
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  test('token guardado sem usuário: restaura via /users/me sem redirecionar', async () => {
    resetSession();
    localStorage.setItem('token', 'token-ADMIN');
    const { useAuthStore } = await import('@/shared/store/auth');
    useAuthStore.setState({ token: 'token-ADMIN', user: null });
    renderWithProviders(<AppRoutes />, { route: '/' });
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Entrar' })).not.toBeInTheDocument();
  });

  test('401 em outra rota → /login?expired=1 com "Sua sessão expirou."', async () => {
    loginAs('ADMIN');
    server.use(http.get(`${API_URL}/receivables`, () => HttpResponse.json({ message: 'Sessão inválida.', code: 'UNAUTHENTICATED' }, { status: 401 })));
    renderWithProviders(<AppRoutes />, { route: '/receivables' });
    expect(await screen.findByText('Sua sessão expirou.')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
  });
});
