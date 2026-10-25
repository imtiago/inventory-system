import { describe, expect, test, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { ChangePasswordModal } from '../ChangePasswordModal';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { loginAs } from '@/test/auth';
import { useAuthStore } from '@/shared/store/auth';

async function fill(current: string, next: string, confirm: string) {
  const dialog = await screen.findByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText('Senha atual'), current);
  await userEvent.type(within(dialog).getByLabelText('Nova senha'), next);
  await userEvent.type(within(dialog).getByLabelText('Confirmar nova senha'), confirm);
  await userEvent.click(within(dialog).getByRole('button', { name: 'Alterar senha' }));
  return dialog;
}

describe('ChangePasswordModal', () => {
  test('envia PUT /users/me/password e fecha em caso de sucesso', async () => {
    const bodies: unknown[] = [];
    const onClose = vi.fn();
    server.use(
      http.put(`${API_URL}/users/me/password`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: { token: 'token-novo' } });
      }),
    );
    renderWithProviders(<ChangePasswordModal open onClose={onClose} />);
    await fill('SenhaAtual1', 'NovaSenha123', 'NovaSenha123');

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodies).toEqual([{ currentPassword: 'SenhaAtual1', newPassword: 'NovaSenha123' }]);
  });

  test('sucesso troca o token guardado pelo novo e mantém o usuário logado', async () => {
    loginAs('VENDEDOR');
    const user = useAuthStore.getState().user;
    const onClose = vi.fn();
    server.use(
      http.put(`${API_URL}/users/me/password`, () => HttpResponse.json({ data: { token: 'token-novo' } })),
    );
    renderWithProviders(<ChangePasswordModal open onClose={onClose} />);
    await fill('SenhaAtual1', 'NovaSenha123', 'NovaSenha123');

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(useAuthStore.getState().token).toBe('token-novo');
    expect(localStorage.getItem('token')).toBe('token-novo');
    expect(useAuthStore.getState().user).toEqual(user);
    expect(useAuthStore.getState().sessionExpired).toBe(false);
  });

  test('erro não troca o token', async () => {
    loginAs('VENDEDOR');
    server.use(
      http.put(`${API_URL}/users/me/password`, () =>
        HttpResponse.json({ message: 'Senha atual incorreta.', code: 'INVALID_CURRENT_PASSWORD' }, { status: 422 }),
      ),
    );
    renderWithProviders(<ChangePasswordModal open onClose={() => {}} />);
    const dialog = await fill('errada1234', 'NovaSenha123', 'NovaSenha123');

    expect(await within(dialog).findByText('Senha atual incorreta.')).toBeInTheDocument();
    expect(useAuthStore.getState().token).toBe('token-VENDEDOR');
  });

  test('confirmação diferente não envia', async () => {
    let called = false;
    server.use(
      http.put(`${API_URL}/users/me/password`, () => ((called = true), HttpResponse.json({ data: { token: 'token-novo' } }))),
    );
    renderWithProviders(<ChangePasswordModal open onClose={() => {}} />);
    const dialog = await fill('SenhaAtual1', 'NovaSenha123', 'Outra123456');

    expect(await within(dialog).findByText('As senhas não coincidem.')).toBeInTheDocument();
    expect(called).toBe(false);
  });

  test('422 INVALID_CURRENT_PASSWORD aparece no campo da senha atual', async () => {
    const onClose = vi.fn();
    server.use(
      http.put(`${API_URL}/users/me/password`, () =>
        HttpResponse.json({ message: 'Senha atual incorreta.', code: 'INVALID_CURRENT_PASSWORD' }, { status: 422 }),
      ),
    );
    renderWithProviders(<ChangePasswordModal open onClose={onClose} />);
    const dialog = await fill('errada1234', 'NovaSenha123', 'NovaSenha123');

    const message = await within(dialog).findByText('Senha atual incorreta.');
    expect(message).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Senha atual')).toHaveAccessibleDescription('Senha atual incorreta.');
    expect(onClose).not.toHaveBeenCalled();
  });

  test('429 mostra a mensagem do backend', async () => {
    server.use(
      http.put(`${API_URL}/users/me/password`, () =>
        HttpResponse.json({ message: 'Muitas tentativas. Tente novamente em alguns minutos.', code: 'TOO_MANY_ATTEMPTS' }, { status: 429 }),
      ),
    );
    renderWithProviders(<ChangePasswordModal open onClose={() => {}} />);
    const dialog = await fill('SenhaAtual1', 'NovaSenha123', 'NovaSenha123');

    expect(await within(dialog).findByText('Muitas tentativas. Tente novamente em alguns minutos.')).toBeInTheDocument();
  });
});
