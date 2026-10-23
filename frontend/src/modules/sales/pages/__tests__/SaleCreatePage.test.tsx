import { describe, expect, test, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';

import { SaleCreatePage } from '../SaleCreatePage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import saleDetail from '@/test/fixtures/sales/saleDetail.json';
import businessRule from '@/test/fixtures/errors/businessRule.json';

const customer = { id: 'c-1', name: 'Maria Oliveira', code: 'CLI-1' };
const priced = { id: 'v-1', name: 'Camiseta Azul', code: 'CAM-1', barcode: '111', productId: 'p-1', salePrice: 39.9 };
const unpriced = { id: 'v-2', name: 'Camiseta Sem Preço', code: 'CAM-2', barcode: '222', productId: 'p-1', salePrice: 0 };

let posted: unknown;

let postedKey: string | null = null;

beforeEach(() => {
  postedKey = null;
  posted = undefined;
  server.use(
    http.get(`${API_URL}/customers`, () => HttpResponse.json({ data: [customer], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })),
    http.get(`${API_URL}/variants/barcode/:code`, ({ params }) => {
      const v = params.code === '111' ? priced : unpriced;
      return HttpResponse.json({ data: v });
    }),
    http.post(`${API_URL}/sales`, async ({ request }) => {
      postedKey = request.headers.get('Idempotency-Key');
      posted = await request.json();
      return HttpResponse.json(saleDetail, { status: 201 });
    }),
  );
});

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/sales/new" element={<SaleCreatePage />} />
      <Route path="/sales/:id" element={<div>Detalhe da venda</div>} />
    </Routes>,
    { route: '/sales/new' },
  );
}

async function pickCustomer() {
  await userEvent.type(screen.getByPlaceholderText('Digite o nome do cliente...'), 'Mar');
  await userEvent.click(await screen.findByText('Maria Oliveira'));
}

async function addBarcode(code: string) {
  await userEvent.type(screen.getByLabelText('Código de barras do produto'), code);
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
}

describe('SaleCreatePage', () => {
  test('selecionar cliente mostra o resumo do cliente escolhido', async () => {
    renderPage();
    expect(screen.queryByText('Maria Oliveira')).not.toBeInTheDocument();
    await pickCustomer();

    expect(await screen.findByText('Maria Oliveira')).toBeInTheDocument();
  });

  test('carrinho mostra preço da variante e total real', async () => {
    renderPage();
    await addBarcode('111');

    const qty = await screen.findByLabelText('Quantidade de Camiseta Azul');
    await userEvent.clear(qty);
    await userEvent.type(qty, '3');

    const row = screen.getByText('CAM-1').closest('tr')!;
    expect(within(row).getAllByText(/39,90/).length).toBe(1);
    expect(within(row).getByText(/119,70/)).toBeInTheDocument();
    expect(screen.getByTestId('sale-total')).toHaveTextContent('119,70');
  });

  test('variante sem preço mostra alerta e bloqueia Registrar venda', async () => {
    renderPage();
    await pickCustomer();
    await addBarcode('222');

    expect(await screen.findByText(/sem preço de venda/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar venda' })).toBeDisabled();
  });

  test('parcelado 3x mostra prévia de 3 parcelas e envia paymentTerms', async () => {
    renderPage();
    await pickCustomer();
    await addBarcode('111');
    await screen.findByLabelText('Quantidade de Camiseta Azul');

    await userEvent.click(screen.getByLabelText('Parcelado'));
    await userEvent.selectOptions(screen.getByLabelText('Número de parcelas'), '3');

    const preview = screen.getByTestId('installments-preview');
    expect(within(preview).getAllByRole('listitem')).toHaveLength(3);
    // 39,90 / 3 = 13,30 cada (soma exata)
    expect(within(preview).getAllByText(/13,30/)).toHaveLength(3);

    await userEvent.click(screen.getByRole('button', { name: 'Registrar venda' }));
    await waitFor(() => expect(posted).toBeDefined());
    const body = posted as { customerId: string; items: unknown[]; paymentTerms: { installments: number; firstDueDate: string } };
    expect(body.customerId).toBe('c-1');
    expect(body.items).toEqual([{ productVariantId: 'v-1', quantity: 1 }]);
    expect(body.paymentTerms.installments).toBe(3);
    expect(body.paymentTerms.firstDueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('à vista envia 1 parcela sem firstDueDate', async () => {
    renderPage();
    await pickCustomer();
    await addBarcode('111');
    await screen.findByLabelText('Quantidade de Camiseta Azul');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar venda' }));
    await waitFor(() => expect(posted).toBeDefined());
    expect((posted as { paymentTerms: unknown }).paymentTerms).toEqual({ installments: 1 });
    expect(postedKey).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
  });

  test('campo de quantidade pode ser apagado e valida no envio', async () => {
    renderPage();
    await pickCustomer();
    await addBarcode('111');

    const qty = await screen.findByLabelText('Quantidade de Camiseta Azul');
    await userEvent.clear(qty);
    expect(qty).toHaveValue(null);

    await userEvent.click(screen.getByRole('button', { name: 'Registrar venda' }));
    expect(await screen.findByText(/quantidade válida/i)).toBeInTheDocument();
    expect(posted).toBeUndefined();
  });

  test('erro do backend aparece uma única vez', async () => {
    server.use(http.post(`${API_URL}/sales`, () => HttpResponse.json(businessRule, { status: 422 })));
    renderPage();
    await pickCustomer();
    await addBarcode('111');
    await screen.findByLabelText('Quantidade de Camiseta Azul');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar venda' }));

    await screen.findByText('Estoque disponível insuficiente.');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getAllByText('Estoque disponível insuficiente.')).toHaveLength(1);
    expect(document.body.textContent?.split('Estoque disponível insuficiente.').length).toBe(2);
  });

  test('sucesso navega para /sales/:id da venda criada', async () => {
    renderPage();
    await pickCustomer();
    await addBarcode('111');
    await screen.findByLabelText('Quantidade de Camiseta Azul');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar venda' }));
    expect(await screen.findByText('Detalhe da venda')).toBeInTheDocument();
  });
});
