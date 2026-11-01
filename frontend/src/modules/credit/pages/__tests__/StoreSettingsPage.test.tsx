import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { renderWithProviders } from '@/test/render';
import storeFixture from '@/test/fixtures/credit/storeSettings.json';

import { StoreSettingsPage } from '../StoreSettingsPage';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const empty = { data: { name: '', cnpj: '', address: '', phone: '', configured: false, updatedAt: null } };

describe('StoreSettingsPage', () => {
  it('carrega os dados com máscara de CNPJ e telefone', async () => {
    server.use(http.get(`${API_URL}/settings/store`, () => HttpResponse.json(storeFixture)));
    renderWithProviders(<StoreSettingsPage />);

    expect(await screen.findByLabelText('Nome da loja')).toHaveValue('Loja da Dona Maria');
    expect(screen.getByLabelText('CNPJ')).toHaveValue('11.222.333/0001-81');
    expect(screen.getByLabelText('Telefone')).toHaveValue('(11) 98888-7777');
    expect(screen.getByLabelText('Endereço')).toHaveValue('Rua das Flores, 100 - Centro, São Paulo/SP');
    expect(screen.queryByText(/ainda não foram preenchidos/)).not.toBeInTheDocument();
  });

  it('sem dados: avisa, valida os campos e só envia depois de preencher (dígitos puros)', async () => {
    server.use(http.get(`${API_URL}/settings/store`, () => HttpResponse.json(empty)));
    let body: unknown;
    server.use(
      http.put(`${API_URL}/settings/store`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(storeFixture);
      }),
    );
    renderWithProviders(<StoreSettingsPage />);

    expect(await screen.findByText(/ainda não foram preenchidos/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Informe o nome da loja.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome da loja')).toHaveAttribute('aria-invalid', 'true');
    expect(body).toBeUndefined();

    await userEvent.type(screen.getByLabelText('Nome da loja'), 'Loja da Dona Maria');
    await userEvent.type(screen.getByLabelText('CNPJ'), '11222333000181');
    await userEvent.type(screen.getByLabelText('Endereço'), 'Rua das Flores, 100');
    await userEvent.type(screen.getByLabelText('Telefone'), '11988887777');
    expect(screen.getByLabelText('CNPJ')).toHaveValue('11.222.333/0001-81');
    expect(screen.getByLabelText('Telefone')).toHaveValue('(11) 98888-7777');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(body).toEqual({ name: 'Loja da Dona Maria', cnpj: '11222333000181', address: 'Rua das Flores, 100', phone: '11988887777' }));
  });

  it('erro do servidor no CNPJ aparece no campo', async () => {
    server.use(
      http.get(`${API_URL}/settings/store`, () => HttpResponse.json(storeFixture)),
      http.put(`${API_URL}/settings/store`, () => HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'Dados inválidos.', errors: [{ field: 'cnpj', message: 'CNPJ inválido.' }] }, { status: 400 })),
    );
    renderWithProviders(<StoreSettingsPage />);

    await screen.findByLabelText('Nome da loja');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('CNPJ inválido.')).toBeInTheDocument();
    expect(screen.getByLabelText('CNPJ')).toHaveAttribute('aria-invalid', 'true');
  });
});
