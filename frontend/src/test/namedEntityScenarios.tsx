import type { ComponentType } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';

import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { loginAs } from '@/test/auth';
import { API_URL } from '@/test/handlers/inventory';

interface Config {
  Page: ComponentType;
  /** Endpoint, e.g. "brands". */
  path: string;
  /** Lowercase noun, e.g. "marca". */
  singular: string;
  plural: string;
  existsCode: string;
  existsMessage: string;
  inUseCode: string;
  inUseMessage: string;
}

const items = [
  { id: 'id-1', name: 'Boticário', productsCount: 12 },
  { id: 'id-2', name: 'Natura', productsCount: 0 },
];

/** Shared scenarios for the brand and category list pages (same behavior, different labels/endpoint). */
export function namedEntityScenarios({ Page, path, singular, plural, existsCode, existsMessage, inUseCode, inUseMessage }: Config) {
  const url = `${API_URL}/${path}`;
  const listRequests: URL[] = [];
  const bodies: unknown[] = [];
  const Cap = singular[0].toUpperCase() + singular.slice(1);

  beforeEach(() => {
    vi.clearAllMocks();
    listRequests.length = 0;
    bodies.length = 0;
    server.use(
      http.get(url, ({ request }) => {
        const u = new URL(request.url);
        listRequests.push(u);
        const search = u.searchParams.get('search')?.toLowerCase();
        const data = search ? items.filter((i) => i.name.toLowerCase().includes(search)) : items;
        return HttpResponse.json({ data, pagination: { page: 1, limit: 10, total: data.length, totalPages: 1 } });
      }),
    );
  });

  async function openPage() {
    const utils = renderWithProviders(<Page />);
    expect(await screen.findByText('Boticário')).toBeInTheDocument();
    return utils;
  }

  describe(`${Cap} list page`, () => {
    test('lista com contagem de produtos, busca (300 ms, limit 10) e cria enviando { name }', async () => {
      server.use(
        http.post(url, async ({ request }) => {
          bodies.push(await request.json());
          return HttpResponse.json({ data: { id: 'new', name: 'Avon', productsCount: 0 } }, { status: 201 });
        }),
      );
      const { queryClient } = await openPage();
      queryClient.setQueryData(['products', 'x'], { stale: true });

      const row = screen.getByText('Boticário').closest('tr') as HTMLElement;
      expect(within(row).getByText('12')).toBeInTheDocument();
      expect(listRequests[0].searchParams.get('limit')).toBe('10');

      await userEvent.type(screen.getByLabelText(`Buscar ${plural}`), 'nat');
      await waitFor(() => expect(screen.queryByText('Boticário')).not.toBeInTheDocument());
      expect(listRequests.at(-1)!.searchParams.get('search')).toBe('nat');
      await userEvent.clear(screen.getByLabelText(`Buscar ${plural}`));
      expect(await screen.findByText('Boticário')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: new RegExp(`Nov[ao] ${singular}`, 'i') }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.type(within(dialog).getByLabelText(/Nome/), '  Avon ');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(bodies).toEqual([{ name: 'Avon' }]);
      expect(queryClient.getQueryState(['products', 'x'])?.isInvalidated).toBe(true);
    });

    test(`renomear envia PUT { name }; 409 ${existsCode} aparece no campo nome e mantém o modal`, async () => {
      server.use(
        http.put(`${url}/:id`, async ({ request, params }) => {
          const body = (await request.json()) as { name: string };
          bodies.push(body);
          if (body.name === 'Natura') return HttpResponse.json({ message: existsMessage, code: existsCode }, { status: 409 });
          return HttpResponse.json({ data: { id: params.id, name: body.name, productsCount: 12 } });
        }),
      );
      await openPage();

      await userEvent.click(screen.getByRole('button', { name: 'Editar Boticário' }));
      const dialog = await screen.findByRole('dialog');
      const input = within(dialog).getByLabelText(/Nome/);
      expect(input).toHaveValue('Boticário');
      await userEvent.clear(input);
      await userEvent.type(input, 'Natura');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));

      expect(await within(dialog).findByText(existsMessage)).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await userEvent.clear(input);
      await userEvent.type(input, 'Boti Novo');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(bodies).toEqual([{ name: 'Natura' }, { name: 'Boti Novo' }]);
    });

    test('nome vazio é validado antes de enviar', async () => {
      await openPage();
      await userEvent.click(screen.getByRole('button', { name: new RegExp(`Nov[ao] ${singular}`, 'i') }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar' }));
      expect(await within(dialog).findByText("Informe o nome.")).toBeInTheDocument();
      expect(bodies).toEqual([]);
    });

    test(`excluir pede confirmação; 409 ${inUseCode} mostra a mensagem uma vez`, async () => {
      let deletes = 0;
      server.use(
        http.delete(`${url}/:id`, () => {
          deletes += 1;
          return HttpResponse.json({ message: inUseMessage, code: inUseCode }, { status: 409 });
        }),
      );
      await openPage();

      await userEvent.click(screen.getByRole('button', { name: 'Excluir Boticário' }));
      expect(deletes).toBe(0);
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
      expect(toast.error).toHaveBeenCalledWith(inUseMessage);
      expect(deletes).toBe(1);
    });

    test('excluir com sucesso (204) fecha a confirmação e recarrega', async () => {
      server.use(http.delete(`${url}/:id`, () => new HttpResponse(null, { status: 204 })));
      await openPage();
      await userEvent.click(screen.getByRole('button', { name: 'Excluir Natura' }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(toast.success).toHaveBeenCalled();
    });

    test('botão excluir oculto para VENDEDOR (que ainda pode editar)', async () => {
      loginAs('VENDEDOR');
      await openPage();
      expect(screen.queryByRole('button', { name: 'Excluir Boticário' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Editar Boticário' })).toBeInTheDocument();
    });
  });
}
