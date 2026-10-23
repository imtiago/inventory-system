import { describe, expect, test } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';

import { SaleDetailPage } from '../SaleDetailPage';
import { SaleListPage } from '../SaleListPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import saleDetail from '@/test/fixtures/sales/saleDetail.json';

const id = saleDetail.data.id;

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/sales/:id" element={<SaleDetailPage />} />
    </Routes>,
    { route: `/sales/${id}` },
  );
}

describe('SaleDetailPage', () => {
  test('detalhe mostra cliente, vendedor, itens com preço, total e parcelas', async () => {
    renderDetail();

    expect(await screen.findByText('Maria Oliveira')).toBeInTheDocument();
    expect(screen.getByText('João Vendedor')).toBeInTheDocument();
    expect(screen.getByText('Concluída')).toBeInTheDocument();
    expect(screen.getByText('Camiseta Básica Azul M')).toBeInTheDocument();
    expect(screen.getByText('Camiseta Básica Preta G')).toBeInTheDocument();
    expect(screen.getAllByText(/39,90/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/119,70/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/159,70/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/53,23/).length).toBe(4);
    expect(screen.getByText('21/11/2026')).toBeInTheDocument();
    expect(screen.getByText('21/01/2027')).toBeInTheDocument();
    expect(screen.getAllByText('Em aberto').length).toBeGreaterThan(0);
  });

  test('cancelar pede confirmação, chama POST /sales/:id/cancel e mostra status Cancelada', async () => {
    let called = 0;
    server.use(
      http.post(`${API_URL}/sales/:id/cancel`, () => {
        called++;
        return HttpResponse.json({
          data: {
            ...saleDetail.data,
            status: 'CANCELED',
            receivable: { ...saleDetail.data.receivable, status: 'CANCELED', parcels: saleDetail.data.receivable.parcels.map((p) => ({ ...p, status: 'CANCELED' })) },
          },
        });
      }),
    );
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar venda' }));
    expect(called).toBe(0);

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /Confirmar cancelamento/ }));

    await waitFor(() => expect(called).toBe(1));
    expect(await screen.findByText('Cancelada', { selector: 'span' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancelar venda' })).not.toBeInTheDocument());
  });

  test('cancelar com 409 SALE_HAS_PAYMENTS mostra a mensagem do backend', async () => {
    server.use(
      http.post(`${API_URL}/sales/:id/cancel`, () =>
        HttpResponse.json({ message: 'Venda possui pagamentos registrados.', code: 'SALE_HAS_PAYMENTS' }, { status: 409 }),
      ),
    );
    renderDetail();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar venda' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /Confirmar cancelamento/ }));

    expect(await screen.findAllByText('Venda possui pagamentos registrados.')).toHaveLength(1);
  });

  test('lista linka para /sales/:id', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/sales" element={<SaleListPage />} />
      </Routes>,
      { route: '/sales' },
    );

    const links = await screen.findAllByRole('link', { name: /#0B6F3C2E/ });
    expect(links[0]).toHaveAttribute('href', `/sales/${id}`);
    expect(screen.getByText('Maria Oliveira')).toBeInTheDocument();
    expect(screen.getByText('Cancelada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Nova Venda/ })).toHaveAttribute('href', '/sales/new');
    expect(document.querySelector('button a, a button')).toBeNull();
  });
});
