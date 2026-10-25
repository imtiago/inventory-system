import { beforeEach, describe, expect, test } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';

import { SaleCreatePage } from '../SaleCreatePage';
import { PurchaseCreatePage } from '@/modules/purchases/pages/PurchaseCreatePage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { setViewport } from '@/test/viewport';
import { API_URL } from '@/test/handlers/inventory';
import saleDetail from '@/test/fixtures/sales/saleDetail.json';
import purchaseDetail from '@/test/fixtures/purchases/purchaseDetail.json';
import supplierList from '@/test/fixtures/purchases/supplierList.json';

const variant = { id: 'v-1', name: 'Camiseta Azul', code: 'CAM-1', barcode: '111', productId: 'p-1', salePrice: 39.9 };
let posted: unknown;

beforeEach(() => {
  posted = undefined;
  server.use(
    http.get(`${API_URL}/customers`, () => HttpResponse.json({ data: [{ id: 'c-1', name: 'Maria Oliveira', code: 'CLI-1' }], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })),
    http.get(`${API_URL}/variants/barcode/:code`, () => HttpResponse.json({ data: variant })),
    http.post(`${API_URL}/sales`, async ({ request }) => {
      posted = await request.json();
      return HttpResponse.json(saleDetail, { status: 201 });
    }),
    http.post(`${API_URL}/purchases`, async ({ request }) => {
      posted = await request.json();
      return HttpResponse.json(purchaseDetail, { status: 201 });
    }),
  );
});

async function addBarcode(code: string) {
  await userEvent.type(screen.getByLabelText('Código de barras do produto'), code);
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
}

function renderSale() {
  return renderWithProviders(
    <Routes>
      <Route path="/sales/new" element={<SaleCreatePage />} />
      <Route path="/sales/:id" element={<div>Detalhe da venda</div>} />
    </Routes>,
    { route: '/sales/new' },
  );
}

function renderPurchase() {
  return renderWithProviders(
    <Routes>
      <Route path="/purchases/new" element={<PurchaseCreatePage />} />
      <Route path="/purchases/:id" element={<div>Detalhe do pedido</div>} />
    </Routes>,
    { route: '/purchases/new' },
  );
}

describe('Itens da venda', () => {
  test('no celular são cartões com − e +, subtotal e remover; no desktop, tabela', async () => {
    setViewport(375);
    renderSale();
    await addBarcode('111');

    const card = (await screen.findByText('CAM-1')).closest('li')!;
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(within(card).getByText('Camiseta Azul')).toBeInTheDocument();
    expect(within(card).getAllByText(/39,90/).length).toBeGreaterThan(0);

    await userEvent.click(within(card).getByRole('button', { name: 'Aumentar quantidade' }));
    expect(within(card).getByLabelText('Quantidade de Camiseta Azul')).toHaveValue('2');
    expect(within(card).getByText(/79,80/)).toBeInTheDocument();
    expect(screen.getByTestId('sale-total')).toHaveTextContent('79,80');

    await userEvent.click(within(card).getByRole('button', { name: 'Remover Camiseta Azul' }));
    expect(screen.queryByText('CAM-1')).not.toBeInTheDocument();
  });

  test('no desktop mantém a tabela', async () => {
    setViewport(1280);
    renderSale();
    await addBarcode('111');
    await screen.findByText('CAM-1');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByLabelText('Quantidade de Camiseta Azul')).toHaveAttribute('inputmode', 'numeric');
  });

  test('o campo de código de barras só recebe foco automático com ponteiro fino', () => {
    setViewport(375, { pointer: 'coarse' });
    const { unmount } = renderSale();
    expect(screen.getByLabelText('Código de barras do produto')).not.toHaveFocus();
    unmount();

    setViewport(1280, { pointer: 'fine' });
    renderSale();
    expect(screen.getByLabelText('Código de barras do produto')).toHaveFocus();
  });
});

describe('Itens do pedido de compra', () => {
  test('no celular: cartão com dinheiro "12,50" e envio em reais corretos', async () => {
    setViewport(375);
    renderPurchase();
    await userEvent.type(screen.getByPlaceholderText('Digite o nome do fornecedor...'), 'Acm');
    await userEvent.click(await screen.findByText('Distribuidora Acme Ltda'));
    await addBarcode('111');

    const card = (await screen.findByText('CAM-1')).closest('li')!;
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    const price = within(card).getByLabelText('Preço unitário de Camiseta Azul');
    expect(price).toHaveAttribute('inputmode', 'decimal');
    expect(price).toHaveAttribute('type', 'text');
    await userEvent.type(price, '12,50');
    await userEvent.click(within(card).getByRole('button', { name: 'Aumentar quantidade' }));

    expect(screen.getByTestId('item-total-v-1')).toHaveTextContent('R$ 25,00');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));
    await waitFor(() => expect(posted).toBeDefined());
    expect((posted as { supplierId: string; items: unknown[] }).supplierId).toBe(supplierList.data[0].id);
    expect((posted as { items: unknown[] }).items).toEqual([{ productVariantId: 'v-1', quantity: 2, unitPrice: 12.5, discount: 0, freight: 0, tax: 0 }]);
  });

  test('no desktop mantém a tabela', async () => {
    setViewport(1280);
    renderPurchase();
    await addBarcode('111');
    await screen.findByText('CAM-1');
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
