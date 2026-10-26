import { describe, expect, test } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';

import { ReceivableDetailPage } from '@/modules/receivables/pages/ReceivableDetailPage';
import { SaleDetailPage } from '@/modules/sales/pages/SaleDetailPage';
import { InventoryListPage } from '@/modules/inventory/pages/InventoryListPage';
import { ProductListPage } from '@/modules/products/pages/ProductListPage';
import { renderWithProviders } from '@/test/render';
import { loginAs } from '@/test/auth';
import { server } from '@/test/server';
import { http, HttpResponse } from 'msw';
import { API_URL } from '@/test/handlers/inventory';
import receivableDetail from '@/test/fixtures/finance/receivableDetail.json';
import saleDetail from '@/test/fixtures/sales/saleDetail.json';

const product = { id: 'p1', name: 'Perfume', code: 'P1', description: '', brand: { name: 'B' }, category: { name: 'C' }, variantsCount: 1 };

function renderProducts() {
  server.use(http.get(`${API_URL}/products`, () => HttpResponse.json({ data: [product], pagination: { page: 1, limit: 10, totalItems: 1, total: 1, totalPages: 1 } })));
  return renderWithProviders(<ProductListPage />);
}

describe('botões por permissão', () => {
  test('estornar: oculto para VENDEDOR, visível para ADMIN', async () => {
    loginAs('VENDEDOR');
    const r = renderWithProviders(
      <Routes><Route path="/receivables/:id" element={<ReceivableDetailPage />} /></Routes>,
      { route: `/receivables/${receivableDetail.data.id}` },
    );
    await screen.findByText('Maria Oliveira');
    expect(screen.queryByRole('button', { name: 'Estornar' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Registrar pagamento' }).length).toBeGreaterThan(0);
    r.unmount();

    loginAs('ADMIN');
    renderWithProviders(
      <Routes><Route path="/receivables/:id" element={<ReceivableDetailPage />} /></Routes>,
      { route: `/receivables/${receivableDetail.data.id}` },
    );
    await screen.findByText('Maria Oliveira');
    expect(screen.getAllByRole('button', { name: 'Estornar' }).length).toBeGreaterThan(0);
  });

  test('cancelar venda: oculto para ESTOQUISTA/sem permissão', async () => {
    loginAs('ESTOQUISTA');
    renderWithProviders(
      <Routes><Route path="/sales/:id" element={<SaleDetailPage />} /></Routes>,
      { route: `/sales/${saleDetail.data.id}` },
    );
    await screen.findByText(/Venda #/);
    expect(screen.queryByRole('button', { name: 'Cancelar venda' })).not.toBeInTheDocument();
  });

  test('botão excluir produto oculto para VENDEDOR, visível para ADMIN', async () => {
    loginAs('VENDEDOR');
    const r = renderProducts();
    await screen.findByText('Perfume');
    expect(document.querySelector('button.text-danger')).toBeNull();
    r.unmount();

    loginAs('ADMIN');
    renderProducts();
    await screen.findByText('Perfume');
    expect(document.querySelector('button.text-danger')).not.toBeNull();
  });

  test('Cenário Inicial oculto para VENDEDOR', async () => {
    loginAs('VENDEDOR');
    renderWithProviders(<InventoryListPage />);
    await screen.findByText(/itens? em estoque/);
    expect(screen.queryByText('Cenário Inicial')).not.toBeInTheDocument();
  });
});
