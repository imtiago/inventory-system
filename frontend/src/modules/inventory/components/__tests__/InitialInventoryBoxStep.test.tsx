import { describe, expect, test, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { InitialInventoryBoxStep } from '../InitialInventoryBoxStep';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import inventoryLotList from '@/test/fixtures/inventory/inventoryLotList.json';

vi.mock('@/components/BarcodeScanner', () => ({
  BarcodeScanner: ({ onDetected }: { onDetected: (code: string) => void }) => (
    <button type="button" onClick={() => onDetected('B000123')}>
      Simular leitura da caixa
    </button>
  ),
}));

function setup() {
  const searches: (string | null)[] = [];
  server.use(
    http.get(`${API_URL}/inventory/boxes`, ({ request }) => {
      searches.push(new URL(request.url).searchParams.get('search'));
      return HttpResponse.json({ data: [{ id: 'box-1', code: 'B000123', createdAt: '2026-10-20T14:35:00.000Z', updatedAt: '2026-10-20T14:35:00.000Z' }] });
    }),
  );

  renderWithProviders(
    <InitialInventoryBoxStep
      lot={inventoryLotList.data[0] as never}
      availableForBoxes={10}
      selectedBox={null}
      loading={false}
      error={null}
      onSelectBox={() => {}}
      onCreateBox={() => {}}
      onAddToBox={() => {}}
      onBack={() => {}}
    />,
  );

  return { searches };
}

describe('InitialInventoryBoxStep', () => {
  test('"Escanear caixa" lê a etiqueta, preenche a busca e fecha a câmera', async () => {
    const { searches } = setup();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Escanear caixa' }));
    await user.click(screen.getByRole('button', { name: 'Simular leitura da caixa' }));

    expect(screen.getByLabelText('Buscar caixa por código')).toHaveValue('B000123');
    expect(screen.queryByRole('button', { name: 'Simular leitura da caixa' })).not.toBeInTheDocument();
    await waitFor(() => expect(searches).toContain('B000123'));
  });

  test('a câmera só abre quando o usuário pede', () => {
    setup();

    expect(screen.queryByRole('button', { name: 'Simular leitura da caixa' })).not.toBeInTheDocument();
  });

  test('caixa selecionada mostra "Na caixa: n" (quantidade deste lote nela) e o total do lote em caixas', async () => {
    const lot = inventoryLotList.data[0];
    server.use(
      http.get(`${API_URL}/inventory/boxes/code/B000123`, () =>
        HttpResponse.json({
          data: {
            id: 'box-1',
            code: 'B000123',
            createdAt: '2026-10-20T14:35:00.000Z',
            updatedAt: '2026-10-20T14:35:00.000Z',
            stocks: [
              { id: 's-other', boxId: 'box-1', quantity: 9, inventoryLot: { ...lot, id: 'other-lot' } },
              { id: 's-1', boxId: 'box-1', quantity: 5, inventoryLot: lot },
            ],
          },
        }),
      ),
    );

    renderWithProviders(
      <InitialInventoryBoxStep
        lot={lot as never}
        availableForBoxes={10}
        selectedBox={{ id: 'box-1', code: 'B000123', createdAt: '', updatedAt: '' }}
        loading={false}
        error={null}
        onSelectBox={() => {}}
        onCreateBox={() => {}}
        onAddToBox={() => {}}
        onBack={() => {}}
      />,
    );

    expect(await screen.findByText('Na caixa: 5')).toBeInTheDocument();
    expect(screen.getByText(/lote tem 12 em caixas no total/)).toBeInTheDocument();
  });
});
