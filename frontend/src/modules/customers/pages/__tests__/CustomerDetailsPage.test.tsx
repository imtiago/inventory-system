import { beforeEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { Route, Routes } from 'react-router-dom';

import { CustomerDetailsPage } from '../CustomerDetailsPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { loginAs } from '@/test/auth';
import { API_URL } from '@/test/handlers/inventory';
import customer from '@/test/fixtures/customers/customer.json';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const bodies: unknown[] = [];

function renderDetails() {
  return renderWithProviders(
    <Routes>
      <Route path="/customers/:id" element={<CustomerDetailsPage />} />
    </Routes>,
    { route: `/customers/${customer.data.id}` },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  bodies.length = 0;
  server.use(
    http.get(`${API_URL}/customers/:id`, () => HttpResponse.json(customer)),
    http.patch(`${API_URL}/customers/:id`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      bodies.push(body);
      return HttpResponse.json({ data: { ...customer.data, ...body } });
    }),
  );
});

describe('CustomerDetailsPage', () => {
  test('mostra o código do cliente, não pedaço do identificador interno', async () => {
    renderDetails();

    expect(await screen.findByText('Cliente C000001')).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(customer.data.id.slice(0, 8), 'i'))).not.toBeInTheDocument();
  });

  test('mostra o CPF/CNPJ formatado', async () => {
    renderDetails();

    expect(await screen.findByText('529.982.247-25')).toBeInTheDocument();
  });

  test('exibe o nome como gravado e não há link para /edit', async () => {
    renderDetails();
    expect(await screen.findByRole('heading', { name: 'Ana McDonald' })).toBeInTheDocument();
    expect(document.querySelector('a[href$="/edit"]')).toBeNull();
  });

  test('Editar abre o modal; alterar só o telefone envia PATCH { phone }', async () => {
    renderDetails();
    await screen.findByRole('heading', { name: 'Ana McDonald' });

    await userEvent.click(screen.getByRole('button', { name: /Editar/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/Nome completo/)).toHaveValue('Ana McDonald');
    const phone = within(dialog).getByLabelText('Telefone');
    await userEvent.clear(phone);
    await userEvent.type(phone, '11911112222');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies).toEqual([{ phone: '11911112222' }]);
  });

  test('limpar o e-mail envia { email: null }', async () => {
    renderDetails();
    await screen.findByRole('heading', { name: 'Ana McDonald' });
    await userEvent.click(screen.getByRole('button', { name: /Editar/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.clear(within(dialog).getByLabelText('E-mail'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies).toEqual([{ email: null }]);
  });

  test('sem alterações: "Nenhuma alteração" e nenhuma requisição', async () => {
    renderDetails();
    await screen.findByRole('heading', { name: 'Ana McDonald' });
    await userEvent.click(screen.getByRole('button', { name: /Editar/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(toast.info).toHaveBeenCalledWith('Nenhuma alteração para salvar.'));
    expect(bodies).toEqual([]);
  });

  test('botão Editar oculto sem customers.write', async () => {
    loginAs('ESTOQUISTA');
    renderDetails();
    await screen.findByRole('heading', { name: 'Ana McDonald' });
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
  });
});
