import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, test } from 'vitest';

import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { renderWithProviders } from '@/test/render';
import inventoryLotList from '@/test/fixtures/inventory/inventoryLotList.json';
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
});
