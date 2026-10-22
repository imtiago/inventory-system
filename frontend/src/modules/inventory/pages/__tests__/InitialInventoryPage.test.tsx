import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { renderWithProviders } from '@/test/render';
import inventoryLot from '@/test/fixtures/inventory/inventoryLot.json';
import inventoryLotList from '@/test/fixtures/inventory/inventoryLotList.json';
import { queryKeys } from '@/shared/react-query/keys';
import { InitialInventoryPage } from '../InitialInventoryPage';

vi.mock('@/components/BarcodeScanner', () => ({
  BarcodeScanner: ({ onDetected }: { onDetected: (code: string) => void }) => (
    <>
      <button type="button" onClick={() => onDetected('7891234567890')}>
        Simular leitura
      </button>
      {/* Camera firing twice before it stops: two detections back to back. */}
      <button
        type="button"
        onClick={() => {
          onDetected('7891234567890');
          onDetected('7890000000002');
        }}
      >
        Simular duas leituras
      </button>
    </>
  ),
}));

const BARCODE = '7891234567890';
const VARIANT_ID = 'a3d9e2f1-7c4b-4e8a-b5d6-1f2e3c4d5a60';
const PRODUCT_ID = 'c7e8f9a0-1b2c-4d3e-8f4a-5b6c7d8e9f01';

const variant = {
  id: VARIANT_ID,
  code: 'CAM-BAS-AZ-M',
  name: 'Camiseta Básica Azul M',
  barcode: BARCODE,
  productId: PRODUCT_ID,
};

const box = {
  id: '9b8c7d6e-5f4a-4b3c-8d2e-1f0a9b8c7d61',
  code: 'B000001',
  createdAt: '2026-10-20T14:35:00.000Z',
  updatedAt: '2026-10-20T14:35:00.000Z',
};

const [lotWithRoom, fullLot] = inventoryLotList.data; // 30 − 12 = 18 ; 12 − 12 = 0

let lotsRequests = 0;
let addItemBodies: unknown[] = [];

beforeEach(() => {
  lotsRequests = 0;
  addItemBodies = [];

  server.use(
    http.get(`${API_URL}/variants/barcode/:code`, ({ params }) =>
      params.code === BARCODE ? HttpResponse.json({ data: variant }) : HttpResponse.json({ message: 'Resource not found' }, { status: 404 }),
    ),
    http.get(`${API_URL}/inventory/variants/:variantId/lots`, () => {
      lotsRequests += 1;
      return HttpResponse.json(inventoryLotList);
    }),
    http.get(`${API_URL}/inventory/boxes`, () =>
      HttpResponse.json({ data: [box], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } }),
    ),
    http.post(`${API_URL}/inventory/boxes/:boxId/items`, async ({ request, params }) => {
      const body = (await request.json()) as { inventoryLotId: string; quantity: number };
      addItemBodies.push(body);
      return HttpResponse.json({ data: { id: 'item-1', boxId: params.boxId, ...body } }, { status: 201 });
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderPage() {
  return renderWithProviders(<InitialInventoryPage />);
}

async function scanBarcode(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /ler código de barras/i }));
  await user.click(screen.getByRole('button', { name: '📷 Ler' }));
  await user.click(screen.getByRole('button', { name: 'Simular leitura' }));
}

async function goToBoxWithLot(user: ReturnType<typeof userEvent.setup>, lotId: string) {
  await scanBarcode(user);
  const select = await screen.findByLabelText('Lote');
  await screen.findByRole('option', { name: /L2026-10-A/ });
  await user.selectOptions(select, lotId);
  await user.click(screen.getByRole('button', { name: 'Confirmar lote' }));
  await screen.findByRole('heading', { name: 'Caixa' });
}

async function addThreeUnitsToBox(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /B000001/ }));
  const quantity = screen.getByLabelText('Quantidade de unidades');
  await user.clear(quantity);
  await user.type(quantity, '3');
  await user.click(screen.getByRole('button', { name: 'Adicionar à caixa' }));
}

describe('InitialInventoryPage (assistente)', () => {
  test("caminho feliz: lê código → cria lote → escolhe caixa existente → 3 unidades → '3 unidade(s) colocada(s) na caixa B000001.'", async () => {
    let lotsData: unknown[] = [];
    let createdLotBody: Record<string, unknown> | null = null;
    server.use(
      http.get(`${API_URL}/inventory/variants/:variantId/lots`, () =>
        HttpResponse.json({ data: lotsData, pagination: { page: 1, limit: 100, total: lotsData.length, totalPages: 1 } }),
      ),
      http.post(`${API_URL}/inventory/lots`, async ({ request }) => {
        createdLotBody = (await request.json()) as Record<string, unknown>;
        lotsData = [inventoryLot.data];
        return HttpResponse.json(inventoryLot, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await scanBarcode(user);
    expect(await screen.findByRole('heading', { name: 'Selecionar lote' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Criar novo lote' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Lote'), 'L2026-10-A');
    await user.type(within(dialog).getByLabelText('Validade'), '2028-09-15');
    await user.clear(within(dialog).getByLabelText('Custo unitário'));
    await user.type(within(dialog).getByLabelText('Custo unitário'), '18.5');
    await user.clear(within(dialog).getByLabelText('Quantidade'));
    await user.type(within(dialog).getByLabelText('Quantidade'), '30');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar lote' }));

    expect(await screen.findByRole('heading', { name: 'Caixa' })).toBeInTheDocument();
    expect(createdLotBody).toMatchObject({ productVariantId: VARIANT_ID, batchNumber: 'L2026-10-A', quantity: 30, unitCost: 18.5 });
    expect(screen.getByText('Lote:').parentElement).toHaveTextContent('L2026-10-A');

    await addThreeUnitsToBox(user);

    expect(await screen.findByText('3 unidade(s) colocada(s) na caixa B000001.')).toBeInTheDocument();
    expect(addItemBodies).toEqual([{ inventoryLotId: inventoryLot.data.id, quantity: 3 }]);
  });

  test("erro 500 na leitura mostra erro e não abre 'produto não encontrado'", async () => {
    server.use(http.get(`${API_URL}/variants/barcode/:code`, () => HttpResponse.json({ message: 'Falha no servidor de produtos' }, { status: 500 })));
    const user = userEvent.setup();
    renderPage();

    await scanBarcode(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Falha no servidor de produtos');
    expect(screen.queryByText('Produto não encontrado')).not.toBeInTheDocument();
    expect(screen.queryByText('Esse produto já existe no cadastro?')).not.toBeInTheDocument();
  });

  test('quantidade da caixa limitada a remaining − allocated', async () => {
    const user = userEvent.setup();
    renderPage();
    await goToBoxWithLot(user, lotWithRoom.id);

    expect(screen.getByText('Disponível para caixas:').parentElement).toHaveTextContent('18');
    await user.click(await screen.findByRole('button', { name: /B000001/ }));
    const quantity = screen.getByLabelText('Quantidade de unidades');
    expect(quantity).toHaveAttribute('max', '18');

    await user.clear(quantity);
    await user.type(quantity, '19');
    await user.click(screen.getByRole('button', { name: 'Adicionar à caixa' }));

    expect(await screen.findByText('Informe uma quantidade entre 1 e 18.')).toBeInTheDocument();
    expect(addItemBodies).toHaveLength(0);
  });

  test('lote totalmente em caixas desabilita quantidade e confirmação', async () => {
    const user = userEvent.setup();
    renderPage();
    await goToBoxWithLot(user, fullLot.id);

    await user.click(await screen.findByRole('button', { name: /B000001/ }));

    expect(screen.getByText('Disponível para caixas:').parentElement).toHaveTextContent('0');
    expect(screen.getByText('Todo o saldo deste lote já está em caixas.')).toBeInTheDocument();
    expect(screen.getByLabelText('Quantidade de unidades')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Adicionar à caixa' })).toBeDisabled();
  });

  test('voltar da caixa para o lote mantém o lote selecionado', async () => {
    const user = userEvent.setup();
    renderPage();
    await goToBoxWithLot(user, lotWithRoom.id);

    await user.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(await screen.findByRole('heading', { name: 'Selecionar lote' })).toBeInTheDocument();
    expect(screen.getByLabelText('Lote')).toHaveValue(lotWithRoom.id);
    expect(screen.getByRole('button', { name: 'Confirmar lote' })).toBeEnabled();
  });

  test('fechar modal de busca de produto volta ao passo anterior (sem tela vazia)', async () => {
    server.use(http.get(`${API_URL}/products`, () => HttpResponse.json({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } })));
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /cadastrar sem código de barras/i }));
    await user.click(screen.getByRole('button', { name: /sim, o produto existe/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fechar modal' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Esse produto já existe no cadastro?')).toBeInTheDocument();
  });

  test('sem código de barras: escolher produto lista variantes existentes', async () => {
    server.use(
      http.get(`${API_URL}/products`, () =>
        HttpResponse.json({
          data: [{ id: PRODUCT_ID, name: 'Camiseta Básica', code: 'CAM-BAS', description: null, brand: { id: 'b1', name: 'Marca' }, category: { id: 'c1', name: 'Roupas' }, variantsCount: 2 }],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        }),
      ),
      http.get(`${API_URL}/products/:productId/variants`, () =>
        HttpResponse.json({
          data: [variant, { ...variant, id: 'v-2', code: 'CAM-BAS-AZ-G', name: 'Camiseta Básica Azul G', barcode: null }],
          pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /cadastrar sem código de barras/i }));
    await user.click(screen.getByRole('button', { name: /sim, o produto existe/i }));
    await user.click(await screen.findByRole('button', { name: /Camiseta Básica/ }));

    expect(await screen.findByRole('button', { name: /Camiseta Básica Azul G/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cadastrar nova variante' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Camiseta Básica Azul M/ }));

    expect(await screen.findByRole('heading', { name: 'Selecionar lote' })).toBeInTheDocument();
    expect(screen.getByText('Variante:').parentElement).toHaveTextContent('Camiseta Básica Azul M');
  });

  test("não exibe prompt 'criar inventário'", async () => {
    server.use(http.get(`${API_URL}/inventory/variants/:variantId`, () => HttpResponse.json({ message: 'Inventory not found' }, { status: 404 })));
    const user = userEvent.setup();
    renderPage();

    await scanBarcode(user);

    expect(await screen.findByRole('heading', { name: 'Selecionar lote' })).toBeInTheDocument();
    expect(screen.queryByText(/criar inventário/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/inventário não encontrado/i)).not.toBeInTheDocument();
  });

  test('mutações invalidam lotes e caixas', async () => {
    const user = userEvent.setup();
    const { queryClient } = renderPage();
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    await goToBoxWithLot(user, lotWithRoom.id);
    const before = lotsRequests;

    await addThreeUnitsToBox(user);
    await screen.findByText('3 unidade(s) colocada(s) na caixa B000001.');

    await waitFor(() => expect(lotsRequests).toBeGreaterThan(before));
    const keys = invalidate.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(keys).toContain(JSON.stringify(queryKeys.inventory));
    expect(keys).toContain(JSON.stringify(queryKeys.inventoryLots(VARIANT_ID)));
    expect(keys).toContain(JSON.stringify([queryKeys.inventoryBoxes()[0]]));
  });

  test('quantidade de etiquetas pode ser apagada e valida no envio', async () => {
    let labelBody: unknown = null;
    server.use(
      http.post(`${API_URL}/inventory/boxes/code/:code/product-labels`, async ({ request }) => {
        labelBody = await request.json();
        return new HttpResponse('%PDF-1.4', { headers: { 'Content-Type': 'application/pdf' } });
      }),
    );
    const createObjectURL = vi.fn(() => 'blob:labels');
    Object.defineProperty(window.URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    vi.spyOn(window, 'open').mockImplementation(() => null);

    const user = userEvent.setup();
    renderPage();
    await goToBoxWithLot(user, lotWithRoom.id);
    await addThreeUnitsToBox(user);

    await user.click(await screen.findByRole('button', { name: 'Sim, gerar etiqueta' }));
    const input = screen.getByLabelText('Quantidade de etiquetas');
    await user.clear(input);
    expect(input).toHaveValue(null);

    await user.click(screen.getByRole('button', { name: 'Gerar etiquetas' }));
    expect(await screen.findByText('Informe uma quantidade de etiquetas válida (mínimo 1).')).toBeInTheDocument();
    expect(labelBody).toBeNull();

    await user.type(input, '2');
    await user.click(screen.getByRole('button', { name: 'Gerar etiquetas' }));

    await waitFor(() => expect(labelBody).toEqual({ productCode: variant.code, quantity: 2 }));
    expect(await screen.findByRole('button', { name: /ler código de barras/i })).toBeInTheDocument();
  });

  test('erro ao carregar lotes mostra a mensagem do servidor', async () => {
    server.use(http.get(`${API_URL}/inventory/variants/:variantId/lots`, () => HttpResponse.json({ message: 'Banco indisponível' }, { status: 500 })));
    const user = userEvent.setup();
    renderPage();

    await scanBarcode(user);

    expect(await screen.findByText('Banco indisponível')).toBeInTheDocument();
  });

  test('duas leituras: a primeira resposta chega por último e o assistente fica com a segunda variante', async () => {
    const second = { ...variant, id: 'v-second', code: 'VAR-2', name: 'Variante Dois', barcode: '7890000000002' };
    const lotsFor: string[] = [];
    server.use(
      http.get(`${API_URL}/variants/barcode/:code`, async ({ params }) => {
        if (params.code === BARCODE) {
          await delay(150);
          return HttpResponse.json({ data: variant });
        }
        return HttpResponse.json({ data: second });
      }),
      http.get(`${API_URL}/inventory/variants/:variantId/lots`, ({ params }) => {
        lotsFor.push(params.variantId as string);
        return HttpResponse.json({ data: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /ler código de barras/i }));
    await user.click(screen.getByRole('button', { name: '📷 Ler' }));
    await user.click(screen.getByRole('button', { name: 'Simular duas leituras' }));

    expect(await screen.findByText('Variante:')).toBeInTheDocument();
    expect(screen.getByText('Variante:').parentElement).toHaveTextContent('Variante Dois');

    await new Promise((resolve) => setTimeout(resolve, 250)); // first (slow) response has arrived
    expect(screen.getByText('Variante:').parentElement).toHaveTextContent('Variante Dois');
    expect(lotsFor).not.toContain(VARIANT_ID);
  });

  test("'Voltar' durante a consulta pendente: ao resolver, o assistente continua no início", async () => {
    let resolved = false;
    server.use(
      http.get(`${API_URL}/variants/barcode/:code`, async () => {
        await delay(150);
        resolved = true;
        return HttpResponse.json({ data: variant });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await scanBarcode(user);
    expect(await screen.findByText('Consultando produto...')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Voltar' }));

    await waitFor(() => expect(resolved).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole('button', { name: /ler código de barras/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Selecionar lote' })).not.toBeInTheDocument();
  });

  test('fechar o modal durante a criação do lote: ao resolver, o assistente fica no passo de lote', async () => {
    let resolved = false;
    server.use(
      http.post(`${API_URL}/inventory/lots`, async () => {
        await delay(150);
        resolved = true;
        return HttpResponse.json(inventoryLot, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await scanBarcode(user);
    await user.click(await screen.findByRole('button', { name: 'Criar novo lote' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Lote'), 'L2026-10-A');
    await user.type(within(dialog).getByLabelText('Validade'), '2028-09-15');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar lote' }));
    await user.click(screen.getByRole('button', { name: 'Fechar modal' }));

    await waitFor(() => expect(resolved).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole('heading', { name: 'Selecionar lote' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Caixa' })).not.toBeInTheDocument();
  });

  test("código não encontrado (404) abre 'produto existe?' com o código lido", async () => {
    server.use(http.get(`${API_URL}/variants/barcode/:code`, () => HttpResponse.json({ message: 'Resource not found' }, { status: 404 })));
    const user = userEvent.setup();
    renderPage();

    await scanBarcode(user);

    expect(await screen.findByText('Esse produto já existe no cadastro?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Produto não encontrado' })).toBeInTheDocument();
    expect(screen.getByText(BARCODE)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('busca de caixa envia ?search=<código> e o resultado pode ser selecionado', async () => {
    const searches: (string | null)[] = [];
    const found = { ...box, id: 'box-found', code: 'B000777' };
    server.use(
      http.get(`${API_URL}/inventory/boxes`, ({ request }) => {
        const search = new URL(request.url).searchParams.get('search');
        searches.push(search);
        return HttpResponse.json({ data: search ? [found] : [box], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await goToBoxWithLot(user, lotWithRoom.id);

    await user.type(screen.getByLabelText('Buscar caixa por código'), 'B000777');
    const result = await screen.findByRole('button', { name: 'B000777' });
    expect(searches).toContain('B000777');

    await user.click(result);
    expect(result).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Caixa selecionada:').parentElement).toHaveTextContent('B000777');
    expect(screen.getByRole('button', { name: 'Adicionar à caixa' })).toBeEnabled();
  });

  test("'Criar nova caixa' seleciona a caixa criada", async () => {
    const user = userEvent.setup();
    renderPage();
    await goToBoxWithLot(user, lotWithRoom.id);
    expect(screen.getByRole('button', { name: 'Adicionar à caixa' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Criar nova caixa' }));

    await waitFor(() => expect(screen.getByText('Caixa selecionada:').parentElement).toHaveTextContent('B000123'));
    expect(screen.getByLabelText('Quantidade de unidades')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Adicionar à caixa' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Adicionar à caixa' }));
    expect(await screen.findByText('1 unidade(s) colocada(s) na caixa B000123.')).toBeInTheDocument();
    expect(addItemBodies).toEqual([{ inventoryLotId: lotWithRoom.id, quantity: 1 }]);
  });

  test('erro 400 de limite da caixa é mostrado no passo de caixa', async () => {
    const message = 'Quantidade excede o saldo do lote disponível para caixas (18).';
    server.use(http.post(`${API_URL}/inventory/boxes/:boxId/items`, () => HttpResponse.json({ message }, { status: 400 })));
    const user = userEvent.setup();
    renderPage();
    await goToBoxWithLot(user, lotWithRoom.id);

    await addThreeUnitsToBox(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('heading', { name: 'Caixa' })).toBeInTheDocument();
  });

  test('Voltar durante adicionar à caixa mantém o passo do lote', async () => {
    let resolved = false;
    server.use(
      http.post(`${API_URL}/inventory/boxes/:boxId/items`, async ({ request, params }) => {
        const body = (await request.json()) as { inventoryLotId: string; quantity: number };
        await delay(150);
        resolved = true;
        return HttpResponse.json({ data: { id: 'item-1', boxId: params.boxId, ...body } }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await goToBoxWithLot(user, lotWithRoom.id);

    await addThreeUnitsToBox(user);
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('heading', { name: 'Selecionar lote' })).toBeInTheDocument();

    await waitFor(() => expect(resolved).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByRole('heading', { name: 'Selecionar lote' })).toBeInTheDocument();
    expect(screen.queryByText(/unidade\(s\) colocada\(s\)/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sim, gerar etiqueta' })).not.toBeInTheDocument();
  });

  test('lote sem número de lote (null) aparece como "Sem lote" no passo de lote', async () => {
    const nullLot = { ...lotWithRoom, batchNumber: null };
    server.use(
      http.get(`${API_URL}/inventory/variants/:variantId/lots`, () => HttpResponse.json({ ...inventoryLotList, data: [nullLot] })),
    );
    const user = userEvent.setup();
    renderPage();
    await scanBarcode(user);
    expect(await screen.findByRole('option', { name: /^Sem lote — restante/ })).toBeInTheDocument();
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
  });

  test('durante adicionar à caixa, os botões de caixa ficam desabilitados', async () => {
    const other = { ...box, id: 'box-other', code: 'B000002' };
    server.use(
      http.get(`${API_URL}/inventory/boxes`, () =>
        HttpResponse.json({ data: [box, other], pagination: { page: 1, limit: 10, total: 2, totalPages: 1 } }),
      ),
      http.post(`${API_URL}/inventory/boxes/:boxId/items`, async ({ request, params }) => {
        const body = (await request.json()) as { inventoryLotId: string; quantity: number };
        await delay(300);
        return HttpResponse.json({ data: { id: 'item-1', boxId: params.boxId, ...body } }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await goToBoxWithLot(user, lotWithRoom.id);

    await addThreeUnitsToBox(user);

    expect(screen.getByRole('button', { name: 'B000002' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /B000001/ })).toBeDisabled();
    expect(screen.getByLabelText('Buscar caixa por código')).toBeDisabled();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Salvando...' })).not.toBeInTheDocument());
  });
});
