import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '@/test/server';
import { loginAs } from '@/test/auth';
import { API_URL } from '@/test/handlers/inventory';
import { renderWithProviders } from '@/test/render';
import creditFixture from '@/test/fixtures/credit/customerCredit.json';

import { CustomerCreditCard } from '../CustomerCreditCard';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

describe('CustomerCreditCard', () => {
  it('shows profile, limit, balance, available, status and history with reasons', async () => {
    renderWithProviders(<CustomerCreditCard customerId={ID} />);

    expect(await screen.findByText('Bom')).toBeInTheDocument();
    expect(screen.getByText('R$ 2.000,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 120,00')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.880,00')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByText('Cliente antiga, sempre pagou em dia')).toBeInTheDocument();
    expect(screen.getByText(/Maria/)).toBeInTheDocument();
    expect(screen.getByText(/Perfil: Novo → Bom/)).toBeInTheDocument();
  });

  it('hides "Ajustar" without credit.manage', async () => {
    loginAs('VENDEDOR');
    renderWithProviders(<CustomerCreditCard customerId={ID} />);

    await screen.findByText('Bom');
    expect(screen.queryByRole('button', { name: 'Ajustar' })).not.toBeInTheDocument();
  });

  it('requires a reason and sends only what changed', async () => {
    let body: object | undefined;
    server.use(
      http.put(`${API_URL}/customers/:id/credit`, async ({ request }) => {
        body = (await request.json()) as object;
        return HttpResponse.json({ data: { ...creditFixture.data, limit: 2500 } });
      }),
    );
    renderWithProviders(<CustomerCreditCard customerId={ID} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Ajustar' }));
    const dialog = await screen.findByRole('dialog');
    const limit = within(dialog).getByLabelText('Limite (R$)');
    expect(limit).toHaveValue('2.000,00');
    await userEvent.clear(limit);
    await userEvent.type(limit, '2500');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar ajuste' }));

    const reason = within(dialog).getByLabelText('Motivo');
    expect(await within(dialog).findByText('Informe o motivo (mínimo 3 letras)')).toBeInTheDocument();
    expect(reason).toHaveAttribute('aria-invalid', 'true');
    expect(body).toBeUndefined();

    await userEvent.type(reason, 'Pagou tudo em dia');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar ajuste' }));

    await waitFor(() => expect(body).toEqual({ limit: 2500, reason: 'Pagou tudo em dia' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('can change the status', async () => {
    let body: object | undefined;
    server.use(
      http.put(`${API_URL}/customers/:id/credit`, async ({ request }) => {
        body = (await request.json()) as object;
        return HttpResponse.json(creditFixture);
      }),
    );
    renderWithProviders(<CustomerCreditCard customerId={ID} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Ajustar' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText('Situação'), 'BLOCKED');
    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'Atrasos repetidos');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar ajuste' }));

    await waitFor(() => expect(body).toEqual({ status: 'BLOCKED', reason: 'Atrasos repetidos' }));
  });

  it('says so when nothing changed', async () => {
    renderWithProviders(<CustomerCreditCard customerId={ID} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Ajustar' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'Sem mudança');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar ajuste' }));

    expect(await within(dialog).findByText('Altere o perfil, o limite ou a situação')).toBeInTheDocument();
  });

  it('shows an empty history message', async () => {
    server.use(http.get(`${API_URL}/customers/:id/credit`, () => HttpResponse.json({ data: { ...creditFixture.data, history: [] } })));
    renderWithProviders(<CustomerCreditCard customerId={ID} />);

    expect(await screen.findByText('Nenhuma alteração registrada.')).toBeInTheDocument();
  });
});
