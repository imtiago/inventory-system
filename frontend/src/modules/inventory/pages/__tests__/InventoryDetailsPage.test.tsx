import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { renderWithProviders } from '@/test/render';
import inventory from '@/test/fixtures/inventory/inventory.json';
import inventoryLotList from '@/test/fixtures/inventory/inventoryLotList.json';
import { setViewport } from '@/test/viewport';
import { InventoryDetailsPage } from '../InventoryDetailsPage';

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/inventory/:id" element={<InventoryDetailsPage />} />
    </Routes>,
    { route: '/inventory/5f1c2a9e-3b7d-4c1e-9a2f-6d8e0b4c7a11' },
  );
}

describe('InventoryDetailsPage', () => {
  test('detalhes mostram saldo, reservado, disponível e custo médio', async () => {
    renderPage();
    expect(await screen.findByText('Camiseta Básica Azul M')).toBeInTheDocument();
    expect(screen.getByText('Saldo').nextSibling).toHaveTextContent('42');
    expect(screen.getByText('Reservado').nextSibling).toHaveTextContent('2');
    expect(screen.getByText('Disponível').nextSibling).toHaveTextContent('40');
    expect(screen.getByText('Custo médio').nextSibling).toHaveTextContent(/R\$\s?18,75/);
  });

  test('tabela de lotes mostra recebido, restante, em caixas, custo e validade', async () => {
    renderPage();
    const row = (await screen.findByText('L2026-10-A')).closest('tr')!;
    const cells = within(row).getAllByRole('cell').map((c) => c.textContent);
    expect(cells[1]).toBe('30');
    expect(cells[2]).toBe('30');
    expect(cells[3]).toBe('12');
    expect(cells[4]).toMatch(/R\$\s?18,50/);
    expect(cells[5]).toBe('15/09/2028');
    for (const h of ['Lote', 'Recebido', 'Restante', 'Em caixas', 'Custo', 'Validade']) {
      expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    }
  });

  test('no celular os lotes viram cartões com lote, validade, quantidades e custo (sem tabela)', async () => {
    setViewport(375);
    renderPage();
    const card = (await screen.findByText('L2026-10-A')).closest('li')!;

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(within(card).getByText('Validade: 15/09/2028')).toBeInTheDocument();
    expect(within(card).getByText('Recebido').nextSibling).toHaveTextContent('30');
    expect(within(card).getByText('Restante').nextSibling).toHaveTextContent('30');
    expect(within(card).getByText('Em caixas').nextSibling).toHaveTextContent('12');
    expect(within(card).getByText('Custo').nextSibling).toHaveTextContent(/R\$\s?18,50/);
  });

  test.each([375, 1280])('sem custo na resposta (VENDEDOR, %ipx): esconde custo médio e coluna/linha de custo, sem NaN/undefined', async (width) => {
    setViewport(width);
    const inv: Record<string, unknown> = { ...inventory.data };
    delete inv.averageCost;
    const lots = inventoryLotList.data.map((l) => {
      const lot: Record<string, unknown> = { ...l };
      delete lot.unitCost;
      return lot;
    });
    server.use(
      http.get(`${API_URL}/inventory/:id`, () => HttpResponse.json({ data: inv })),
      http.get(`${API_URL}/inventory/variants/:variantId/lots`, () => HttpResponse.json({ ...inventoryLotList, data: lots })),
    );
    const { container } = renderPage();
    await screen.findByText('L2026-10-A');
    expect(screen.queryByText('Custo médio')).not.toBeInTheDocument();
    expect(screen.queryByText('Custo')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Custo' })).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/NaN|undefined|R\$/);
    expect(screen.getByText('Saldo').nextSibling).toHaveTextContent('42');
  });

  test('validade 2026-12-31T00:00:00.000Z aparece como 31/12/2026', async () => {
    const lot = { ...inventoryLotList.data[0], expirationDate: '2026-12-31T00:00:00.000Z' };
    server.use(
      http.get(`${API_URL}/inventory/variants/:variantId/lots`, () =>
        HttpResponse.json({ ...inventoryLotList, data: [lot] }),
      ),
    );
    renderPage();
    expect(await screen.findByText('31/12/2026')).toBeInTheDocument();
  });

  test('detalhes pedem até 100 lotes (cabeçalho e tabela consistentes)', async () => {
    const limits: (string | null)[] = [];
    server.use(
      http.get(`${API_URL}/inventory/variants/:variantId/lots`, ({ request }) => {
        limits.push(new URL(request.url).searchParams.get('limit'));
        return HttpResponse.json(inventoryLotList);
      }),
    );
    renderPage();
    await screen.findByText('L2026-10-A');
    expect(limits).toEqual(['100']);
  });

  test('lote sem número de lote (null) mostra "Sem lote", nunca "null"', async () => {
    const lot = { ...inventoryLotList.data[0], batchNumber: null };
    server.use(
      http.get(`${API_URL}/inventory/variants/:variantId/lots`, () =>
        HttpResponse.json({ ...inventoryLotList, data: [lot] }),
      ),
    );
    renderPage();
    const cell = await screen.findByText('Sem lote');
    expect(cell.closest('tr')).toBeTruthy();
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
  });

  test('mostra "Vencido: n" em destaque e marca o lote vencido (com saldo) na tabela', async () => {
    const expiredLot = { ...inventoryLotList.data[0], batchNumber: 'L-VELHO', expirationDate: '2020-01-01T00:00:00.000Z' };
    const validLot = inventoryLotList.data[1];
    server.use(
      http.get(`${API_URL}/inventory/:id`, () => HttpResponse.json({ data: { ...inventory.data, expired: 5 } })),
      http.get(`${API_URL}/inventory/variants/:variantId/lots`, () => HttpResponse.json({ ...inventoryLotList, data: [expiredLot, validLot] })),
    );
    renderPage();
    expect(await screen.findByText('Vencido: 5')).toBeInTheDocument();
    const expiredRow = (await screen.findByText('L-VELHO')).closest('tr')!;
    expect(within(expiredRow).getByText('Vencido')).toBeInTheDocument();
    const validRow = screen.getByText('L2026-09-B').closest('tr')!;
    expect(within(validRow).queryByText('Vencido')).not.toBeInTheDocument();
  });

  test('sem vencidos não mostra "Vencido"', async () => {
    renderPage();
    await screen.findByText('L2026-10-A');
    expect(screen.queryByText(/Vencido/)).not.toBeInTheDocument();
  });
});
