import { beforeEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { CustomerListPage } from '../CustomerListPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { loginAs } from '@/test/auth';
import { API_URL } from '@/test/handlers/inventory';
import customerList from '@/test/fixtures/customers/customerList.json';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const requests: URL[] = [];
const bodies: { method: string; body: unknown }[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  requests.length = 0;
  bodies.length = 0;
  server.use(
    http.get(`${API_URL}/customers`, ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json(customerList);
    }),
    http.post(`${API_URL}/customers`, async ({ request }) => {
      bodies.push({ method: 'POST', body: await request.json() });
      return HttpResponse.json({ data: customerList.data[0] }, { status: 201 });
    }),
    http.patch(`${API_URL}/customers/:id`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      bodies.push({ method: 'PATCH', body });
      return HttpResponse.json({ data: { ...customerList.data[0], ...body } });
    }),
  );
});

describe('CustomerListPage', () => {
  test('mostra nomes como gravados, envia limit=10 e busca', async () => {
    renderWithProviders(<CustomerListPage />);
    expect(await screen.findByText('Ana McDonald')).toBeInTheDocument();
    expect(screen.getByText('Bruno Souza')).toBeInTheDocument();
    expect(requests[0].searchParams.get('limit')).toBe('10');

    await userEvent.type(screen.getByLabelText('Buscar clientes'), 'ana');
    await waitFor(() => expect(requests.at(-1)!.searchParams.get('search')).toBe('ana'));
  });

  test('editar na lista envia só os campos alterados (PATCH { name })', async () => {
    renderWithProviders(<CustomerListPage />);
    await screen.findByText('Ana McDonald');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Ana McDonald' }));
    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText(/Nome completo/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Ana Maria');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies).toEqual([{ method: 'PATCH', body: { name: 'Ana Maria' } }]);
  });

  test('botões de criar e editar ocultos sem customers.write', async () => {
    loginAs('ESTOQUISTA');
    renderWithProviders(<CustomerListPage />);
    await screen.findByText('Ana McDonald');
    expect(screen.queryByRole('button', { name: /Novo Cliente/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
  });

  test('criar cliente envia POST com o nome', async () => {
    renderWithProviders(<CustomerListPage />);
    await screen.findByText('Ana McDonald');
    await userEvent.click(screen.getByRole('button', { name: /Novo Cliente/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Nome completo/), 'Carla Nova');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar cliente' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0].body).toMatchObject({ name: 'Carla Nova' });
  });
});

describe('CustomerListPage modal while saving', () => {
  test('Escape, backdrop and X do not close the edit modal while the PATCH is pending', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.patch(`${API_URL}/customers/:id`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push({ method: 'PATCH', body });
        await gate;
        return HttpResponse.json({ data: { ...customerList.data[0], ...body } });
      }),
    );
    renderWithProviders(<CustomerListPage />);
    await screen.findByText('Ana McDonald');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Ana McDonald' }));
    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText(/Nome completo/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Ana Maria');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(bodies).toHaveLength(1));

    await userEvent.keyboard('{Escape}');
    await userEvent.pointer([{ keys: '[MouseLeft>]', target: dialog }, { keys: '[/MouseLeft]' }]);
    const close = screen.queryByRole('button', { name: 'Fechar modal' });
    if (close) await userEvent.click(close);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies).toHaveLength(1);
  });
});
