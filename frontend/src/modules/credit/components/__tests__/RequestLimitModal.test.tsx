import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '@/test/server';
import { loginAs } from '@/test/auth';
import { API_URL } from '@/test/handlers/inventory';
import { renderWithProviders } from '@/test/render';
import creditFixture from '@/test/fixtures/credit/customerCredit.json';
import requests from '@/test/fixtures/credit/creditLimitRequests.json';

import { CustomerCreditCard } from '../CustomerCreditCard';

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('@/shared/utils/notify', () => ({ notify }));

const ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

describe('Pedir aumento de limite (ficha do cliente)', () => {
  it('só aparece com credit.request (ESTOQUISTA não vê)', async () => {
    loginAs('ESTOQUISTA');
    renderWithProviders(<CustomerCreditCard customerId={ID} />);
    await screen.findByText('Bom');
    expect(screen.queryByRole('button', { name: 'Pedir aumento de limite' })).not.toBeInTheDocument();
  });

  it('VENDEDOR pede: valida valor > limite atual e motivo, envia Idempotency-Key e avisa que foi para aprovação', async () => {
    loginAs('VENDEDOR');
    let body: unknown = null;
    let key: string | null = null;
    server.use(
      http.post(`${API_URL}/credit/limit-requests`, async ({ request }) => {
        body = await request.json();
        key = request.headers.get('Idempotency-Key');
        return HttpResponse.json({ data: requests.data[0] }, { status: 201 });
      }),
    );
    renderWithProviders(<CustomerCreditCard customerId={ID} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Pedir aumento de limite' }));
    const dialog = await screen.findByRole('dialog');
    const limit = within(dialog).getByLabelText('Novo limite (R$)');
    await userEvent.type(limit, '1500');
    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'ab');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar pedido' }));
    expect(await within(dialog).findByText('Informe o motivo (3 a 300 caracteres)')).toBeInTheDocument();
    expect(body).toBeNull();

    await userEvent.clear(limit);
    await userEvent.type(limit, '1000');
    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'c');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar pedido' }));
    expect(await within(dialog).findByText(/maior que o limite atual/)).toBeInTheDocument();
    expect(body).toBeNull();

    await userEvent.clear(limit);
    await userEvent.type(limit, '3000');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar pedido' }));

    await waitFor(() => expect(body).toEqual({ customerId: ID, requestedLimit: 3000, reason: 'abc' }));
    expect(key).toBeTruthy();
    await waitFor(() => expect(notify.success).toHaveBeenCalledWith(expect.stringMatching(/enviado para aprovação/i)));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('pedido auto-aprovado avisa que o limite já subiu', async () => {
    loginAs('VENDEDOR');
    server.use(
      http.post(`${API_URL}/credit/limit-requests`, () =>
        HttpResponse.json({ data: { ...requests.data[0], status: 'APPROVED', autoApproved: true, approvedLimit: 3000 } }, { status: 201 }),
      ),
    );
    renderWithProviders(<CustomerCreditCard customerId={ID} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Pedir aumento de limite' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Novo limite (R$)'), '3000');
    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'Cliente em dia');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar pedido' }));

    await waitFor(() => expect(notify.success).toHaveBeenCalledWith(expect.stringMatching(/aprovado automaticamente.*R\$\s3\.000,00/i)));
  });

  it('mostra a mensagem da API (já existe pedido em aberto) e mantém o modal', async () => {
    loginAs('VENDEDOR');
    server.use(
      http.post(`${API_URL}/credit/limit-requests`, () =>
        HttpResponse.json({ message: 'Já existe um pedido de aumento em aberto para este cliente.', code: 'CREDIT_REQUEST_ALREADY_PENDING' }, { status: 409 }),
      ),
    );
    renderWithProviders(<CustomerCreditCard customerId={ID} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Pedir aumento de limite' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Novo limite (R$)'), String(creditFixture.data.limit + 1000));
    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'Quer comprar mais');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enviar pedido' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Já existe um pedido de aumento em aberto para este cliente.');
  });
});
