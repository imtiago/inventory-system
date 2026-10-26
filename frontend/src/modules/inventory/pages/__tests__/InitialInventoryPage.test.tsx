import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { renderWithProviders } from '@/test/render';
import internalError from '@/test/fixtures/errors/internal.json';
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
      params.code === BARCODE ? HttpResponse.json({ data: variant }) : HttpResponse.json({ message: 'Variante não encontrada.', code: 'VARIANT_NOT_FOUND' }, { status: 404 }),
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
  await user.click(screen.getByRole('button', { name: 'Ler' }));
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
    server.use(http.get(`${API_URL}/variants/barcode/:code`, () => HttpResponse.json(internalError, { status: 500 })));
    const user = userEvent.setup();
    renderPage();

    await scanBarcode(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(internalError.message);
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
    server.use(http.get(`${API_URL}/inventory/variants/:variantId`, () => HttpResponse.json({ message: 'Inventory not found', code: 'NOT_FOUND' }, { status: 404 })));
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

  /** Captures <a download> clicks and object URLs; window.open must never be used for the PDF. */
  function mockDownloads() {
    const downloads: { href: string; name: string }[] = [];
    const revoked: string[] = [];
    Object.defineProperty(window.URL, 'createObjectURL', { value: vi.fn(() => 'blob:labels'), configurable: true });
    Object.defineProperty(window.URL, 'revokeObjectURL', { value: vi.fn((url: string) => revoked.push(url)), configurable: true });
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push({ href: this.href, name: this.download });
    });
    return { downloads, revoked, open };
  }

  test('quantidade de etiquetas pode ser apagada e valida no envio; o PDF é baixado como arquivo (sem window.open)', async () => {
    let labelBody: unknown = null;
    server.use(
      http.post(`${API_URL}/inventory/boxes/code/:code/product-labels`, async ({ request }) => {
        labelBody = await request.json();
        return new HttpResponse('%PDF-1.4', { headers: { 'Content-Type': 'application/pdf' } });
      }),
    );
    const { downloads, open } = mockDownloads();

    const user = userEvent.setup();
    renderPage();
    await goToBoxWithLot(user, lotWithRoom.id);
    await addThreeUnitsToBox(user);

    await user.click(await screen.findByRole('button', { name: 'Sim, gerar etiqueta' }));
    const input = screen.getByLabelText('Quantidade de etiquetas');
    await user.clear(input);
    expect(input).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Gerar etiquetas' }));
    expect(await screen.findByText('Informe uma quantidade de etiquetas válida (mínimo 1).')).toBeInTheDocument();
    expect(labelBody).toBeNull();

    await user.type(input, '2');
    await user.click(screen.getByRole('button', { name: 'Gerar etiquetas' }));

    await waitFor(() => expect(labelBody).toEqual({ productCode: variant.code, quantity: 2 }));
    // O assistente não avança sozinho nem baixa sem o clique do usuário.
    expect(await screen.findByRole('heading', { name: 'Etiquetas prontas' })).toBeInTheDocument();
    expect(downloads).toEqual([]);
    expect(screen.queryByRole('button', { name: /ler código de barras/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Baixar PDF' }));
    expect(downloads).toEqual([{ href: 'blob:labels', name: 'etiquetas-B000001.pdf' }]);
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Etiquetas prontas' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByRole('button', { name: /ler código de barras/i })).toBeInTheDocument();
  });

  test('etiquetas: link anexado ao DOM e URL do PDF revogada 60 s depois do download', async () => {
    server.use(
      http.post(`${API_URL}/inventory/boxes/code/:code/product-labels`, () => new HttpResponse('%PDF-1.4', { headers: { 'Content-Type': 'application/pdf' } })),
    );
    const { revoked } = mockDownloads();
    let attachedOnClick = false;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      attachedOnClick = document.body.contains(this);
    });
    const user = userEvent.setup();
    renderPage();
    await goToBoxWithLot(user, lotWithRoom.id);
    await addThreeUnitsToBox(user);
    await user.click(await screen.findByRole('button', { name: 'Sim, gerar etiqueta' }));
    await user.click(screen.getByRole('button', { name: 'Gerar etiquetas' }));
    await screen.findByRole('heading', { name: 'Etiquetas prontas' });

    vi.useFakeTimers();
    try {
      await act(async () => {
        screen.getByRole('button', { name: 'Baixar PDF' }).click();
      });
      expect(attachedOnClick).toBe(true);
      vi.advanceTimersByTime(59_000);
      expect(revoked).toEqual([]);
      vi.advanceTimersByTime(1_500);
      expect(revoked).toEqual(['blob:labels']);
    } finally {
      vi.useRealTimers();
    }
  });

  test('etiquetas: "Compartilhar" só aparece quando o aparelho aceita compartilhar arquivo e envia o PDF', async () => {
    server.use(
      http.post(`${API_URL}/inventory/boxes/code/:code/product-labels`, () => new HttpResponse('%PDF-1.4', { headers: { 'Content-Type': 'application/pdf' } })),
    );
    mockDownloads();
    const user = userEvent.setup();
    renderPage();
    await goToBoxWithLot(user, lotWithRoom.id);
    await addThreeUnitsToBox(user);
    await user.click(await screen.findByRole('button', { name: 'Sim, gerar etiqueta' }));
    await user.click(screen.getByRole('button', { name: 'Gerar etiquetas' }));
    await screen.findByRole('heading', { name: 'Etiquetas prontas' });
    expect(screen.queryByRole('button', { name: 'Compartilhar' })).not.toBeInTheDocument();

    // outro render, agora com Web Share de arquivos
    cleanup();
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    try {
      renderPage();
      await goToBoxWithLot(user, lotWithRoom.id);
      await addThreeUnitsToBox(user);
      await user.click(await screen.findByRole('button', { name: 'Sim, gerar etiqueta' }));
      await user.click(screen.getByRole('button', { name: 'Gerar etiquetas' }));
      await user.click(await screen.findByRole('button', { name: 'Compartilhar' }));

      expect(share).toHaveBeenCalledTimes(1);
      const arg = share.mock.calls[0][0] as { files: File[] };
      expect(arg.files[0].name).toBe('etiquetas-B000001.pdf');
      expect(arg.files[0].type).toBe('application/pdf');
    } finally {
      delete (navigator as { canShare?: unknown }).canShare;
      delete (navigator as { share?: unknown }).share;
    }
  });

  test('etiquetas: "Gerar de novo" volta para a quantidade', async () => {
    server.use(
      http.post(`${API_URL}/inventory/boxes/code/:code/product-labels`, () => new HttpResponse('%PDF-1.4', { headers: { 'Content-Type': 'application/pdf' } })),
    );
    mockDownloads();
    const user = userEvent.setup();
    renderPage();
    await goToBoxWithLot(user, lotWithRoom.id);
    await addThreeUnitsToBox(user);
    await user.click(await screen.findByRole('button', { name: 'Sim, gerar etiqueta' }));
    await user.click(screen.getByRole('button', { name: 'Gerar etiquetas' }));
    await user.click(await screen.findByRole('button', { name: 'Gerar de novo' }));

    expect(screen.getByLabelText('Quantidade de etiquetas')).toBeInTheDocument();
  });

  test('etiquetas: "Voltar" durante a geração não baixa o PDF', async () => {
    let resolved = false;
    server.use(
      http.post(`${API_URL}/inventory/boxes/code/:code/product-labels`, async () => {
        await delay(150);
        resolved = true;
        return new HttpResponse('%PDF-1.4', { headers: { 'Content-Type': 'application/pdf' } });
      }),
    );
    const { downloads, open } = mockDownloads();
    const user = userEvent.setup();
    renderPage();
    await goToBoxWithLot(user, lotWithRoom.id);
    await addThreeUnitsToBox(user);
    await user.click(await screen.findByRole('button', { name: 'Sim, gerar etiqueta' }));
    await user.click(screen.getByRole('button', { name: 'Gerar etiquetas' }));
    await user.click(screen.getByRole('button', { name: 'Voltar' }));

    await waitFor(() => expect(resolved).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(downloads).toEqual([]);
    expect(open).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /ler código de barras/i })).not.toBeInTheDocument();
  });

  test('etiquetas: falha ao entregar o arquivo mostra aviso e não conclui o passo', async () => {
    server.use(
      http.post(`${API_URL}/inventory/boxes/code/:code/product-labels`, () => new HttpResponse('%PDF-1.4', { headers: { 'Content-Type': 'application/pdf' } })),
    );
    mockDownloads();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    const user = userEvent.setup();
    renderPage();
    await goToBoxWithLot(user, lotWithRoom.id);
    await addThreeUnitsToBox(user);
    await user.click(await screen.findByRole('button', { name: 'Sim, gerar etiqueta' }));
    await user.click(screen.getByRole('button', { name: 'Gerar etiquetas' }));
    await user.click(await screen.findByRole('button', { name: 'Baixar PDF' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível entregar o PDF das etiquetas');
    expect(screen.getByRole('heading', { name: 'Etiquetas prontas' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ler código de barras/i })).not.toBeInTheDocument();
  });

  test('erro ao carregar lotes mostra a mensagem do servidor', async () => {
    server.use(http.get(`${API_URL}/inventory/variants/:variantId/lots`, () => HttpResponse.json({ message: 'Banco indisponível', code: 'INTERNAL_ERROR' }, { status: 500 })));
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
    await user.click(screen.getByRole('button', { name: 'Ler' }));
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

  test('modal de lote não pode ser fechado durante a criação; ao resolver o lote é selecionado e o assistente avança', async () => {
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
    await user.type(within(dialog).getByLabelText('Custo unitário'), '10');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar lote' }));

    expect(screen.queryByRole('button', { name: 'Fechar modal' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await waitFor(() => expect(resolved).toBe(true));
    expect(await screen.findByRole('heading', { name: 'Caixa' })).toBeInTheDocument();
    expect(screen.getByText('Lote:').parentElement).toHaveTextContent('L2026-10-A');
  });

  test("404 VARIANT_NOT_FOUND leva a 'produto não encontrado': abre 'produto existe?' com o código lido", async () => {
    server.use(http.get(`${API_URL}/variants/barcode/:code`, () => HttpResponse.json({ message: 'Variante não encontrada.', code: 'VARIANT_NOT_FOUND' }, { status: 404 })));
    const user = userEvent.setup();
    renderPage();

    await scanBarcode(user);

    expect(await screen.findByText('Esse produto já existe no cadastro?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Produto não encontrado' })).toBeInTheDocument();
    expect(screen.getByText(BARCODE)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test("status não-404 com code VARIANT_NOT_FOUND também leva a 'produto não encontrado'", async () => {
    server.use(http.get(`${API_URL}/variants/barcode/:code`, () => HttpResponse.json({ message: 'Variante não encontrada.', code: 'VARIANT_NOT_FOUND' }, { status: 422 })));
    const user = userEvent.setup();
    renderPage();

    await scanBarcode(user);

    expect(await screen.findByText('Esse produto já existe no cadastro?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Produto não encontrado' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('novo produto no assistente: erro 400 de campo aparece inline no formulário', async () => {
    server.use(
      http.get(`${API_URL}/brands`, () => HttpResponse.json({ data: [] })),
      http.get(`${API_URL}/categories`, () => HttpResponse.json({ data: [] })),
      http.post(`${API_URL}/products`, () =>
        HttpResponse.json(
          { message: 'Dados inválidos.', code: 'VALIDATION_ERROR', errors: [{ field: 'name', message: 'O nome é obrigatório.' }] },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /cadastrar sem código de barras/i }));
    await user.click(screen.getByRole('button', { name: /não, é um produto novo/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Preço de venda (R$)'), '10');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar Produto' }));

    expect(await within(dialog).findByText('O nome é obrigatório.')).toBeInTheDocument();
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
    server.use(http.post(`${API_URL}/inventory/boxes/:boxId/items`, () => HttpResponse.json({ message, code: 'BUSINESS_RULE' }, { status: 400 })));
    const user = userEvent.setup();
    renderPage();
    await goToBoxWithLot(user, lotWithRoom.id);

    await addThreeUnitsToBox(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('heading', { name: 'Caixa' })).toBeInTheDocument();
  });

  test('Voltar fica desabilitado durante adicionar à caixa e o resultado é aplicado ao terminar', async () => {
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
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByRole('heading', { name: 'Caixa' })).toBeInTheDocument();

    await waitFor(() => expect(resolved).toBe(true));
    expect(await screen.findByText(/3 unidade\(s\) colocada\(s\) na caixa B000001/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sim, gerar etiqueta' })).toBeInTheDocument();
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

  test('busca de produtos: resposta antiga que chega depois não sobrescreve a mais recente', async () => {
    server.use(
      http.get(`${API_URL}/products`, async ({ request }) => {
        const term = new URL(request.url).searchParams.get('search');
        const item = (name: string) => ({ id: name, name, code: name, description: null, variantsCount: 1 });
        if (term === '') {
          await delay(700);
          return HttpResponse.json({ data: [item('Produto antigo')], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
        }
        return HttpResponse.json({ data: [item('Produto novo')], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /cadastrar sem código de barras/i }));
    await user.click(screen.getByRole('button', { name: /sim, o produto existe/i }));
    // The empty search fires after the debounce, then the user types before it answers.
    await new Promise((resolve) => setTimeout(resolve, 400));
    await user.type(screen.getByLabelText('Pesquisar produto'), 'novo');

    expect(await screen.findByRole('button', { name: /Produto novo/ })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(screen.getByRole('button', { name: /Produto novo/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Produto antigo/ })).not.toBeInTheDocument();
  });

  test('lote: custo unitário começa vazio e é obrigatório (nada é enviado)', async () => {
    let posted = false;
    server.use(
      http.post(`${API_URL}/inventory/lots`, () => {
        posted = true;
        return HttpResponse.json(inventoryLot, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await scanBarcode(user);
    await user.click(await screen.findByRole('button', { name: 'Criar novo lote' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByLabelText('Custo unitário')).toHaveValue('');
    await user.type(within(dialog).getByLabelText('Lote'), 'L1');
    await user.type(within(dialog).getByLabelText('Validade'), '2028-09-15');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar lote' }));

    expect(await within(dialog).findByText('Informe o custo unitário.')).toBeInTheDocument();
    expect(posted).toBe(false);
  });

  test('lote: erro de validação do backend aparece uma única vez (inline), sem banner duplicado', async () => {
    server.use(
      http.post(`${API_URL}/inventory/lots`, () =>
        HttpResponse.json(
          { message: 'Dados inválidos.', code: 'VALIDATION_ERROR', errors: [{ field: 'batchNumber', message: 'Lote já existe.' }] },
          { status: 400 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    await scanBarcode(user);
    await user.click(await screen.findByRole('button', { name: 'Criar novo lote' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Lote'), 'L1');
    await user.type(within(dialog).getByLabelText('Validade'), '2028-09-15');
    await user.type(within(dialog).getByLabelText('Custo unitário'), '10');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar lote' }));

    expect(await within(dialog).findByText('Lote já existe.')).toBeInTheDocument();
    expect(within(dialog).queryByText('Dados inválidos.')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });

  test('lote: erro sem campo (500) aparece uma única vez como alerta', async () => {
    server.use(http.post(`${API_URL}/inventory/lots`, () => HttpResponse.json({ message: 'Falha interna.', code: 'INTERNAL_ERROR' }, { status: 500 })));
    const user = userEvent.setup();
    renderPage();
    await scanBarcode(user);
    await user.click(await screen.findByRole('button', { name: 'Criar novo lote' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Lote'), 'L1');
    await user.type(within(dialog).getByLabelText('Validade'), '2028-09-15');
    await user.type(within(dialog).getByLabelText('Custo unitário'), '10');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar lote' }));

    expect(await within(dialog).findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent('Falha interna.');
    expect(within(dialog).getAllByText('Falha interna.')).toHaveLength(1);
  });
});
