import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { loginAs } from '@/test/auth';
import { API_URL } from '@/test/handlers/inventory';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { CategoryListPage } from '@/modules/categories/pages/CategoryListPage';
import { ProductForm } from '@/modules/products/components/ProductForm';
import { VariantForm } from '@/modules/products/components/VariantForm';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

const emptyPage = { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } };
const LABEL = 'Margem desejada (%)';

const picked = {
  initialValues: { brandId: 'b-0', categoryId: 'c-0', name: 'Perfume' },
  initialBrand: { id: 'b-0', name: 'Marca', productsCount: 0 },
  initialCategory: { id: 'c-0', name: 'Categoria', productsCount: 0 },
};

function useCatalogHandlers() {
  server.use(
    http.get(`${API_URL}/brands`, () => HttpResponse.json(emptyPage)),
    http.get(`${API_URL}/categories`, () => HttpResponse.json(emptyPage)),
  );
}

describe('Margem desejada nos formulários', () => {
  it('ProductForm: ADMIN vê o campo e envia a margem em bps só quando mexeu nele', async () => {
    useCatalogHandlers();
    const onSubmit = vi.fn();
    renderWithProviders(<ProductForm title="Novo" description="" {...picked} onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.type(screen.getByLabelText(LABEL), '35');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ targetMarginBps: 3500 });
  });

  it('ProductForm: sem mexer no campo não envia targetMarginBps', async () => {
    useCatalogHandlers();
    const onSubmit = vi.fn();
    renderWithProviders(<ProductForm title="Novo" description="" {...picked} onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect('targetMarginBps' in onSubmit.mock.calls[0][0]).toBe(false);
  });

  it('ProductForm: esvaziar uma margem já definida envia null', async () => {
    useCatalogHandlers();
    const onSubmit = vi.fn();
    renderWithProviders(
      <ProductForm title="Editar" description="" {...picked} initialValues={{ ...picked.initialValues, targetMarginBps: 3500 }} onSubmit={onSubmit} onCancel={() => {}} />,
    );

    expect(screen.getByLabelText(LABEL)).toHaveValue('35,00');
    await userEvent.clear(screen.getByLabelText(LABEL));
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ targetMarginBps: null });
  });

  it('ProductForm: percentual inválido bloqueia o envio', async () => {
    useCatalogHandlers();
    const onSubmit = vi.fn();
    renderWithProviders(<ProductForm title="Novo" description="" {...picked} onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.type(screen.getByLabelText(LABEL), '120');
    await userEvent.click(screen.getByRole('button', { name: /salvar/i }));

    expect(await screen.findByText('O percentual deve ser menor que 100%')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ProductForm: VENDEDOR não vê o campo', () => {
    loginAs('VENDEDOR');
    useCatalogHandlers();
    renderWithProviders(<ProductForm title="Novo" description="" {...picked} onSubmit={vi.fn()} onCancel={() => {}} />);

    expect(screen.queryByLabelText(LABEL)).not.toBeInTheDocument();
  });

  it('VariantForm: ADMIN envia a margem; VENDEDOR não vê o campo', async () => {
    const onSubmit = vi.fn();
    const { unmount } = renderWithProviders(<VariantForm title="Nova" submitLabel="Salvar Variante" initialValues={{ name: 'Padrão', salePrice: 10 }} onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.type(screen.getByLabelText(LABEL), '42,5');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar Variante' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ targetMarginBps: 4250 });
    unmount();

    loginAs('VENDEDOR');
    renderWithProviders(<VariantForm title="Nova" submitLabel="Salvar Variante" onSubmit={vi.fn()} onCancel={() => {}} />);
    expect(screen.queryByLabelText(LABEL)).not.toBeInTheDocument();
  });

  it('Categoria: grava a margem pela rota de margens depois de criar', async () => {
    const calls: unknown[] = [];
    server.use(
      http.get(`${API_URL}/categories`, () => HttpResponse.json({ data: [{ id: 'c1', name: 'Perfumes', productsCount: 1 }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })),
      http.post(`${API_URL}/categories`, () => HttpResponse.json({ data: { id: 'new-cat', name: 'Cremes', productsCount: 0 } }, { status: 201 })),
      http.put(`${API_URL}/pricing/target-margins/:level/:id`, async ({ params, request }) => {
        calls.push({ params, body: await request.json() });
        return HttpResponse.json({ data: { level: 'category', id: 'new-cat', targetMarginPercent: 35 } });
      }),
    );
    renderWithProviders(<CategoryListPage />);

    await userEvent.click(await screen.findByRole('button', { name: /Nova categoria/i }));
    await userEvent.type(await screen.findByLabelText(/Nome/), 'Cremes');
    await userEvent.type(screen.getByLabelText(LABEL), '35');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ params: { level: 'category', id: 'new-cat' }, body: { targetMarginPercent: 35 } });
  });

  it('Categoria e Marca: VENDEDOR não vê o campo', async () => {
    loginAs('VENDEDOR');
    server.use(http.get(`${API_URL}/categories`, () => HttpResponse.json({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } })));
    renderWithProviders(<CategoryListPage />);

    await userEvent.click(await screen.findByRole('button', { name: /Nova categoria/i }));
    await screen.findByLabelText(/Nome/);
    expect(screen.queryByLabelText(LABEL)).not.toBeInTheDocument();
  });
});
