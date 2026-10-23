import { describe, expect, test } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';

import { Login } from '../Login';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { resetSession } from '@/test/auth';
import { useAuthStore } from '@/shared/store/auth';

function renderLogin(route = '/login') {
  resetSession();
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<div>home</div>} />
    </Routes>,
    { route },
  );
}

describe('Login', () => {
  test("login envia o que o usuário digita; Enter envia; 401 mostra 'E-mail ou senha inválidos.' sem recarregar", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API_URL}/auth/login`, async ({ request }) => {
        const body = (await request.json()) as { email: string; password: string };
        bodies.push(body);
        if (body.password !== 'SenhaCorreta1') {
          return HttpResponse.json({ message: 'Credenciais inválidas.', code: 'INVALID_CREDENTIALS' }, { status: 401 });
        }
        return HttpResponse.json({ data: { token: 'token-VENDEDOR', user: { id: 'u1', name: 'Vera', email: 'vera@example.com', role: 'VENDEDOR' } } });
      }),
    );
    renderLogin();

    await userEvent.type(screen.getByLabelText('Email'), 'vera@example.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'errada123{Enter}');

    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeInTheDocument();
    expect(bodies).toEqual([{ email: 'vera@example.com', password: 'errada123' }]);
    expect(screen.getByLabelText('Email')).toHaveValue('vera@example.com');

    await userEvent.clear(screen.getByLabelText('Senha'));
    await userEvent.type(screen.getByLabelText('Senha'), 'SenhaCorreta1{Enter}');

    expect(await screen.findByText('home')).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBe('token-VENDEDOR');
    expect(useAuthStore.getState().user?.role).toBe('VENDEDOR');
  });

  test('campos obrigatórios: não envia vazio', async () => {
    let called = false;
    server.use(http.post(`${API_URL}/auth/login`, () => ((called = true), HttpResponse.json({}, { status: 500 }))));
    renderLogin();

    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findAllByText(/obrigatório/i)).not.toHaveLength(0);
    expect(called).toBe(false);
  });

  test('429 mostra a mensagem do backend', async () => {
    server.use(
      http.post(`${API_URL}/auth/login`, () =>
        HttpResponse.json({ message: 'Muitas tentativas. Tente novamente em alguns minutos.', code: 'TOO_MANY_ATTEMPTS' }, { status: 429 }),
      ),
    );
    renderLogin();

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'qualquer123{Enter}');

    expect(await screen.findByText('Muitas tentativas. Tente novamente em alguns minutos.')).toBeInTheDocument();
  });

  test('?expired=1 mostra aviso de sessão expirada', () => {
    renderLogin('/login?expired=1');
    expect(screen.getByText('Sua sessão expirou.')).toBeInTheDocument();
  });
});
