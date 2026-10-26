import { describe, expect, test, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';

import { PurchaseCreatePage } from '../PurchaseCreatePage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import purchaseDetail from '@/test/fixtures/purchases/purchaseDetail.json';
import supplierList from '@/test/fixtures/purchases/supplierList.json';
import { todayInBusinessTz } from '@/shared/utils/businessDate';
import { addDaysToDateOnly } from '@/modules/sales/utils/installments';

const variant = { id: 'v-1', name: 'Camiseta Azul', code: 'CAM-1', barcode: '111', productId: 'p-1', salePrice: 39.9 };

let posted: unknown;

beforeEach(() => {
  posted = undefined;
  server.use(
    http.get(`${API_URL}/variants/barcode/:code`, () => HttpResponse.json({ data: variant })),
    http.post(`${API_URL}/purchases`, async ({ request }) => {
      posted = await request.json();
      return HttpResponse.json(purchaseDetail, { status: 201 });
    }),
  );
});

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/purchases/new" element={<PurchaseCreatePage />} />
      <Route path="/purchases/:id" element={<div>Detalhe do pedido</div>} />
    </Routes>,
    { route: '/purchases/new' },
  );
}

async function pickSupplier() {
  await userEvent.type(screen.getByPlaceholderText('Digite o nome do fornecedor...'), 'Acm');
  await userEvent.click(await screen.findByText('Distribuidora Acme Ltda'));
}

async function addVariant() {
  await userEvent.type(screen.getByLabelText('Código de barras do produto'), '111');
  await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }));
  await screen.findByLabelText('Quantidade de Camiseta Azul');
}

async function fill(label: string, value: string) {
  const input = screen.getByLabelText(label);
  await userEvent.clear(input);
  await userEvent.type(input, value);
}

describe('PurchaseCreatePage', () => {
  test('totais por item e geral, prévia de parcelas e corpo enviado', async () => {
    expect(supplierList.data).toHaveLength(2);
    renderPage();
    await pickSupplier();
    await addVariant();

    await fill('Quantidade de Camiseta Azul', '3');
    await fill('Preço unitário de Camiseta Azul', '10.5');
    await fill('Desconto de Camiseta Azul', '1');
    await fill('Frete de Camiseta Azul', '0.5');
    await fill('Imposto de Camiseta Azul', '0.25');

    // 3 x 10,50 - 1,00 + 0,50 + 0,25 = 31,25
    expect(screen.getByTestId('item-total-v-1')).toHaveTextContent('R$ 31,25');
    expect(screen.getByTestId('purchase-total')).toHaveTextContent('R$ 31,25');

    await userEvent.click(screen.getByLabelText('Parcelado'));
    await userEvent.selectOptions(screen.getByLabelText('Número de parcelas'), '2');
    const preview = screen.getByTestId('installments-preview');
    expect(within(preview).getAllByRole('listitem')).toHaveLength(2);
    expect(within(preview).getByText('R$ 15,62')).toBeInTheDocument();
    expect(within(preview).getByText('R$ 15,63')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Observações'), 'Entrega na loja');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));

    const today = todayInBusinessTz();
    await waitFor(() =>
      expect(posted).toEqual({
        supplierId: supplierList.data[0].id,
        purchaseDate: today,
        notes: 'Entrega na loja',
        items: [{ productVariantId: 'v-1', quantity: 3, unitPrice: 10.5, discount: 1, freight: 0.5, tax: 0.25 }],
        paymentTerms: { installments: 2, firstDueDate: addDaysToDateOnly(today, 30) },
      }),
    );
    expect(await screen.findByText('Detalhe do pedido')).toBeInTheDocument();
  });

  test('bloqueia envio com total zero ou item negativo', async () => {
    renderPage();
    await pickSupplier();
    await addVariant();

    // preço padrão 0 => total geral zero
    expect(screen.getByRole('button', { name: 'Registrar pedido' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('maior que zero');

    await fill('Preço unitário de Camiseta Azul', '5');
    await fill('Desconto de Camiseta Azul', '9');
    expect(screen.getByRole('button', { name: 'Registrar pedido' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('negativo');
    expect(posted).toBeUndefined();
  });

  test('erro do backend é exibido uma vez', async () => {
    server.use(
      http.post(`${API_URL}/purchases`, () => HttpResponse.json({ message: 'Total do item inválido.', code: 'INVALID_ITEM_TOTAL' }, { status: 422 })),
    );
    renderPage();
    await pickSupplier();
    await addVariant();
    await fill('Preço unitário de Camiseta Azul', '5');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));

    expect(await screen.findAllByText('Total do item inválido.')).toHaveLength(1);
  });

  test('mais de 2 casas decimais é inválido: mensagem no campo e nenhum envio', async () => {
    renderPage();
    await pickSupplier();
    await addVariant();
    await fill('Preço unitário de Camiseta Azul', '10,555');

    expect(screen.getByText('Use no máximo 2 casas decimais')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('2 casas decimais');
    expect(screen.getByRole('button', { name: 'Registrar pedido' })).toBeDisabled();
    expect(posted).toBeUndefined();
  });

  test('"1.000" no preço unitário é mil reais e chega como 1000 na API', async () => {
    renderPage();
    await pickSupplier();
    await addVariant();
    await fill('Preço unitário de Camiseta Azul', '1.000');

    expect(screen.getByTestId('item-total-v-1')).toHaveTextContent('R$ 1.000,00');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));

    await waitFor(() => expect(posted).toMatchObject({ items: [{ unitPrice: 1000, discount: 0, freight: 0, tax: 0 }] }));
  });

  test('"1.23,4" no preço mostra "Valor inválido" e bloqueia', async () => {
    renderPage();
    await pickSupplier();
    await addVariant();
    await fill('Preço unitário de Camiseta Azul', '1.23,4');

    expect(screen.getByText('Valor inválido')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar pedido' })).toBeDisabled();
  });

  test('preço com 1 casa envia 10.5 e o total mostrado confere', async () => {
    renderPage();
    await pickSupplier();
    await addVariant();
    await fill('Preço unitário de Camiseta Azul', '10.5');
    expect(screen.getByTestId('purchase-total')).toHaveTextContent('R$ 10,50');
    await userEvent.click(screen.getByRole('button', { name: 'Registrar pedido' }));

    await waitFor(() => expect(posted).toMatchObject({ items: [{ unitPrice: 10.5, discount: 0, freight: 0, tax: 0 }] }));
  });
});
