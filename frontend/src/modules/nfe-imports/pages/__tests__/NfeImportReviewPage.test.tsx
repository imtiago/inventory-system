import { beforeEach, describe, expect, test } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Link, Route, Routes } from 'react-router-dom';

import { NfeImportReviewPage } from '../NfeImportReviewPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { loginAs } from '@/test/auth';
import { API_URL } from '@/test/handlers/inventory';
import nfeImport from '@/test/fixtures/nfe/nfeImport.json';
import brandList from '@/test/fixtures/catalog/brandList.json';
import purchaseDetail from '@/test/fixtures/purchases/purchaseDetail.json';

const draft = nfeImport.data;
let posted: unknown;

beforeEach(() => {
  posted = undefined;
  server.use(
    http.get(`${API_URL}/brands`, () => HttpResponse.json(brandList)),
    http.get(`${API_URL}/categories`, () =>
      HttpResponse.json({ data: [{ id: 'cat-1', name: 'Higiene' }], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } }),
    ),
    http.post(`${API_URL}/nfe-imports/:id/confirm`, async ({ request }) => {
      posted = await request.json();
      return HttpResponse.json({ data: { importId: draft.id, purchaseId: 'pc-1' } }, { status: 201 });
    }),
  );
});

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/nfe-imports/:id" element={<NfeImportReviewPage />} />
      <Route path="/purchases/:id" element={<div>Detalhe do pedido</div>} />
    </Routes>,
    { route: `/nfe-imports/${draft.id}` },
  );
}

const item = (n: number) => screen.getByTestId(`nfe-item-${n}`);

async function prepareItem2AsNewProduct() {
  await userEvent.selectOptions(screen.getByLabelText('Ação do item 2'), 'createProduct');
  await userEvent.selectOptions(screen.getByLabelText('Marca do item 2'), brandList.data[0].id);
  await userEvent.selectOptions(screen.getByLabelText('Categoria do item 2'), 'cat-1');
  await userEvent.type(screen.getByLabelText('Preço de venda do item 2'), '7.5');
  await userEvent.clear(screen.getByLabelText('Unidades por embalagem do item 2'));
  await userEvent.type(screen.getByLabelText('Unidades por embalagem do item 2'), '2');
}

describe('NfeImportReviewPage', () => {
  test('sugestões vêm pré-selecionadas; item sem sugestão exige escolher vincular ou criar', async () => {
    renderPage();
    await screen.findByTestId('nfe-item-1');

    expect(screen.getByText('Chave de acesso')).toBeInTheDocument();
    expect(within(item(1)).getByText('Shampoo Exemplo — 300ml (SHA-300)')).toBeInTheDocument();
    expect(within(item(1)).getByText(/mapeamento/i)).toBeInTheDocument();
    expect(within(item(3)).getByText('Condicionador Exemplo — 200ml (CON-200)')).toBeInTheDocument();
    expect(within(item(3)).getByText(/código de barras/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Unidades por embalagem do item 1')).toHaveValue('12');

    expect(screen.getByLabelText('Ação do item 2')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeDisabled();
    expect(screen.getByTestId('blocking-reason')).toHaveTextContent('Item 2');
  });

  test('fornecedor encontrado é somente leitura; sem cadastro permite editar o nome', async () => {
    renderPage();
    expect(await screen.findByText('Distribuidora Exemplo')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nome do fornecedor')).not.toBeInTheDocument();
  });

  test('fornecedor não cadastrado: "Será cadastrado" com nome editável enviado em create', async () => {
    server.use(http.get(`${API_URL}/nfe-imports/:id`, () => HttpResponse.json({ data: { ...draft, supplier: { ...draft.supplier, match: null } } })));
    renderPage();

    expect(await screen.findByText('Será cadastrado')).toBeInTheDocument();
    const name = screen.getByLabelText('Nome do fornecedor');
    expect(name).toHaveValue('Distribuidora Exemplo Ltda');
    await userEvent.clear(name);
    await userEvent.type(name, 'Nova Dist');
    await prepareItem2AsNewProduct();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importação' }));

    await waitFor(() => expect(posted).toBeDefined());
    expect((posted as { supplier: unknown }).supplier).toEqual({ create: { name: 'Nova Dist' } });
  });

  test('unidades por embalagem atualiza a quantidade em unidades e bloqueia quantidade não inteira', async () => {
    renderPage();
    await screen.findByTestId('nfe-item-1');

    expect(within(item(1)).getByTestId('item-units-1')).toHaveTextContent('24');
    await userEvent.clear(screen.getByLabelText('Unidades por embalagem do item 1'));
    await userEvent.type(screen.getByLabelText('Unidades por embalagem do item 1'), '6');
    expect(within(item(1)).getByTestId('item-units-1')).toHaveTextContent('12');

    await userEvent.selectOptions(screen.getByLabelText('Ação do item 2'), 'createProduct');
    expect(within(item(2)).getByRole('alert')).toHaveTextContent('não resulta em unidades inteiras');
    expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeDisabled();

    await userEvent.clear(screen.getByLabelText('Unidades por embalagem do item 2'));
    await userEvent.type(screen.getByLabelText('Unidades por embalagem do item 2'), '2');
    expect(within(item(2)).getByTestId('item-units-2')).toHaveTextContent('21');
    expect(within(item(2)).queryByRole('alert')).not.toBeInTheDocument();
  });

  test('parcelas editáveis com soma conferida ao centavo', async () => {
    renderPage();
    await screen.findByTestId('nfe-item-1');
    await prepareItem2AsNewProduct();

    const sum = screen.getByTestId('installments-sum');
    expect(sum).toHaveTextContent('R$ 397,09');
    expect(screen.getByLabelText('Valor da parcela 3')).toHaveValue('132,37');
    expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeEnabled();

    // Até R$ 0,05 de diferença: aviso de ajuste da última parcela, confirmação liberada.
    await userEvent.clear(screen.getByLabelText('Valor da parcela 3'));
    await userEvent.type(screen.getByLabelText('Valor da parcela 3'), '132.32');
    expect(screen.getByTestId('installments-adjusted')).toHaveTextContent('397,04');
    expect(screen.getByTestId('installments-adjusted')).toHaveTextContent('a última parcela será ajustada');
    expect(screen.queryByTestId('installments-mismatch')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeEnabled();

    // 6 centavos: bloqueia.
    await userEvent.clear(screen.getByLabelText('Valor da parcela 3'));
    await userEvent.type(screen.getByLabelText('Valor da parcela 3'), '132.31');
    expect(screen.getByTestId('installments-mismatch')).toHaveTextContent('397,03');
    expect(screen.getByTestId('installments-mismatch')).toHaveTextContent('mais de R$ 0,05');
    expect(screen.queryByTestId('installments-adjusted')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeDisabled();

    await userEvent.clear(screen.getByLabelText('Valor da parcela 3'));
    await userEvent.type(screen.getByLabelText('Valor da parcela 3'), '132.37');
    expect(screen.queryByTestId('installments-mismatch')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeEnabled();
  });

  test('confirmar envia o corpo esperado e navega para o pedido', async () => {
    renderPage();
    await screen.findByTestId('nfe-item-1');
    await prepareItem2AsNewProduct();
    await userEvent.type(screen.getByLabelText('Código de barras do item 2'), '7890000000024');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importação' }));

    expect(await screen.findByText('Detalhe do pedido')).toBeInTheDocument();
    expect(posted).toEqual({
      supplier: { id: draft.supplier.match.id },
      items: [
        { index: 1, link: { productVariantId: draft.items[0].suggestion!.productVariantId, unitsPerPackage: 12 } },
        {
          index: 2,
          create: {
            newProduct: { name: 'Sabonete Granel', brandId: brandList.data[0].id, categoryId: 'cat-1' },
            variantName: 'Padrão',
            barcode: '7890000000024',
            salePrice: 7.5,
            unitsPerPackage: 2,
          },
        },
        { index: 3, link: { productVariantId: draft.items[2].suggestion!.productVariantId, unitsPerPackage: 1 } },
      ],
      installments: [
        { dueDate: '2026-11-22', amount: 132.36 },
        { dueDate: '2026-12-22', amount: 132.36 },
        { dueDate: '2027-01-21', amount: 132.37 },
      ],
      receive: true,
    });
  });

  test('navega para o pedido mesmo quando a revisão desmonta com a confirmação em andamento', async () => {
    let confirmed = false;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.get(`${API_URL}/nfe-imports/:id`, () =>
        HttpResponse.json({ data: confirmed ? { ...draft, status: 'CONFIRMED', purchaseId: 'pc-1' } : draft }),
      ),
      http.post(`${API_URL}/nfe-imports/:id/confirm`, async () => {
        confirmed = true;
        await gate;
        return HttpResponse.json({ data: { importId: draft.id, purchaseId: 'pc-1' } }, { status: 201 });
      }),
    );
    const { queryClient } = renderPage();
    await screen.findByTestId('nfe-item-1');
    await prepareItem2AsNewProduct();
    await userEvent.type(screen.getByLabelText('Código de barras do item 2'), '7890000000024');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importação' }));

    // Com a requisição pendente, a nota é relida (ex.: foco da janela) e já vem CONFIRMED: o formulário desmonta.
    await queryClient.invalidateQueries({ queryKey: ['nfe-imports'] });
    expect(await screen.findByText('Esta nota já foi confirmada.', { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirmando/ })).not.toBeInTheDocument();

    release();
    expect(await screen.findByText('Detalhe do pedido')).toBeInTheDocument();
  });

  test('vincular a variante existente busca produto e escolhe a variante', async () => {
    server.use(
      http.get(`${API_URL}/products`, () =>
        HttpResponse.json({
          data: [{ id: 'p-9', code: 'P9', name: 'Sabonete Líquido', description: null, brand: { id: 'b', name: 'B' }, category: { id: 'c', name: 'C' }, variantsCount: 1 }],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        }),
      ),
      http.get(`${API_URL}/products/p-9/variants`, () =>
        HttpResponse.json({
          data: [{ id: 'v-9', productId: 'p-9', code: 'V9', name: 'Refil 500ml', barcode: null, salePrice: 9 }],
          pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
        }),
      ),
    );
    renderPage();
    await screen.findByTestId('nfe-item-1');

    await userEvent.selectOptions(screen.getByLabelText('Ação do item 2'), 'link');
    await userEvent.type(screen.getByLabelText('Buscar produto do item 2'), 'Sabonete');
    await userEvent.click(await screen.findByText('Sabonete Líquido'));
    await userEvent.selectOptions(await screen.findByLabelText('Variante do item 2'), 'v-9');
    await userEvent.clear(screen.getByLabelText('Unidades por embalagem do item 2'));
    await userEvent.type(screen.getByLabelText('Unidades por embalagem do item 2'), '2');
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importação' }));

    await waitFor(() => expect(posted).toBeDefined());
    expect((posted as { items: unknown[] }).items[1]).toEqual({ index: 2, link: { productVariantId: 'v-9', unitsPerPackage: 2 } });
  });

  test('entrada no estoque só com purchases.receive', async () => {
    loginAs('VENDEDOR');
    renderPage();
    await screen.findByTestId('nfe-item-1');
    expect(screen.queryByLabelText('Dar entrada no estoque agora')).not.toBeInTheDocument();
    await prepareItem2AsNewProduct();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importação' }));

    await waitFor(() => expect(posted).toBeDefined());
    expect((posted as { receive: boolean }).receive).toBe(false);
  });

  test('checkbox de entrada no estoque vem marcado e pode ser desmarcado', async () => {
    renderPage();
    const box = await screen.findByLabelText('Dar entrada no estoque agora');
    expect(box).toBeChecked();
    await userEvent.click(box);
    await prepareItem2AsNewProduct();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importação' }));

    await waitFor(() => expect(posted).toBeDefined());
    expect((posted as { receive: boolean }).receive).toBe(false);
  });

  test('erro da confirmação que cita o item aparece só na linha; sem item, no alerta do topo', async () => {
    let call = 0;
    server.use(
      http.post(`${API_URL}/nfe-imports/:id/confirm`, () => {
        call += 1;
        return call === 1
          ? HttpResponse.json({ message: 'Quantidade do item 2 não resulta em unidades inteiras.', code: 'NFE_QUANTITY_NOT_INTEGER' }, { status: 422 })
          : HttpResponse.json({ message: 'A soma das parcelas difere do total do pedido.', code: 'INSTALLMENTS_TOTAL_MISMATCH' }, { status: 422 });
      }),
    );
    renderPage();
    await screen.findByTestId('nfe-item-1');
    await prepareItem2AsNewProduct();

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importação' }));
    expect(await screen.findAllByText('Quantidade do item 2 não resulta em unidades inteiras.')).toHaveLength(1);
    expect(within(item(2)).getByText('Quantidade do item 2 não resulta em unidades inteiras.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importação' }));
    expect(await screen.findAllByText('A soma das parcelas difere do total do pedido.')).toHaveLength(1);
    expect(screen.getByTestId('confirm-error')).toHaveTextContent('A soma das parcelas');
    expect(screen.queryByText('Quantidade do item 2 não resulta em unidades inteiras.')).not.toBeInTheDocument();
  });

  test('erro de cadastro do item ("Item 3: ...") aparece na linha do item 3', async () => {
    server.use(
      http.post(`${API_URL}/nfe-imports/:id/confirm`, () =>
        HttpResponse.json({ message: 'Item 3: Código de barras já cadastrado.', code: 'BARCODE_ALREADY_EXISTS' }, { status: 409 }),
      ),
    );
    renderPage();
    await screen.findByTestId('nfe-item-1');
    await prepareItem2AsNewProduct();

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importação' }));
    expect(await within(item(3)).findByText('Item 3: Código de barras já cadastrado.')).toBeInTheDocument();
    expect(screen.getAllByText('Item 3: Código de barras já cadastrado.')).toHaveLength(1);
    expect(screen.queryByTestId('confirm-error')).not.toBeInTheDocument();
  });

  test('item que não compõe o total (indTot=0): aviso e confirmação desabilitada', async () => {
    server.use(
      http.get(`${API_URL}/nfe-imports/:id`, () =>
        HttpResponse.json({ data: { ...draft, items: draft.items.map((i) => (i.index === 3 ? { ...i, composesTotal: false } : i)) } }),
      ),
    );
    renderPage();
    await screen.findByTestId('nfe-item-1');
    await prepareItem2AsNewProduct();

    expect(screen.getByTestId('unsupported-items')).toHaveTextContent(
      'Esta nota tem itens que não compõem o total (indTot=0); a importação não é suportada.',
    );
    expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeDisabled();
  });

  test('total da nota diferente do total do pedido: aviso de arredondamento; iguais: sem aviso', async () => {
    renderPage();
    await screen.findByTestId('nfe-item-1');
    expect(screen.queryByTestId('note-total-difference')).not.toBeInTheDocument();
  });

  test('total da nota 0,01 acima do pedido mostra a diferença', async () => {
    server.use(http.get(`${API_URL}/nfe-imports/:id`, () => HttpResponse.json({ data: { ...draft, totalAmount: 397.1, totals: { ...draft.totals, total: 397.1, difference: 0.01 } } })));
    renderPage();
    await screen.findByTestId('nfe-item-1');
    expect(screen.getByTestId('note-total-difference').textContent?.replace(/\s/g, ' ')).toBe(
      'Total do pedido difere do total da nota em R$ 0,01 (arredondamento da nota).',
    );
  });

  test('duplicatas da nota que não fecham com o pedido mostram a divergência antes de confirmar', async () => {
    server.use(
      http.get(`${API_URL}/nfe-imports/:id`, () =>
        HttpResponse.json({ data: { ...draft, totals: { ...draft.totals, installmentsTotal: 397.12, installmentsDifference: 0.03 } } }),
      ),
    );
    renderPage();
    await screen.findByTestId('nfe-item-1');
    expect(screen.getByTestId('note-installments-difference').textContent?.replace(/\s/g, ' ')).toBe(
      'As duplicatas da nota somam R$ 397,12, diferente do total do pedido (R$ 397,09) em R$ 0,03.',
    );
  });

  test('chave de acesso alfanumérica agrupada de 4 em 4; duplicata sem número mostra "—"', async () => {
    const key = '35261011AB2C33000181550010000123451123456784';
    server.use(
      http.get(`${API_URL}/nfe-imports/:id`, () =>
        HttpResponse.json({
          data: { ...draft, accessKey: key, installments: [{ ...draft.installments[0], number: null }, ...draft.installments.slice(1)] },
        }),
      ),
    );
    renderPage();
    await screen.findByTestId('nfe-item-1');

    expect(screen.getByText('3526 1011 AB2C 3300 0181 5500 1000 0123 4511 2345 6784')).toBeInTheDocument();
    expect(screen.getByTestId('installment-number-0')).toHaveTextContent('—');
    expect(screen.getByTestId('installment-number-1')).toHaveTextContent('002');
  });

  test('confirmar redireciona ao pedido só se o usuário ainda está na tela da importação', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    server.use(
      http.post(`${API_URL}/nfe-imports/:id/confirm`, async () => {
        await gate;
        return HttpResponse.json({ data: { importId: draft.id, purchaseId: 'pc-1' } }, { status: 201 });
      }),
    );
    renderWithProviders(
      <>
        <Link to="/outra">Ir para outra tela</Link>
        <Routes>
          <Route path="/nfe-imports/:id" element={<NfeImportReviewPage />} />
          <Route path="/purchases/:id" element={<div>Detalhe do pedido</div>} />
          <Route path="/outra" element={<div>Outra tela</div>} />
        </Routes>
      </>,
      { route: `/nfe-imports/${draft.id}` },
    );
    await screen.findByTestId('nfe-item-1');
    await prepareItem2AsNewProduct();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importação' }));
    await userEvent.click(screen.getByRole('link', { name: 'Ir para outra tela' }));
    expect(await screen.findByText('Outra tela')).toBeInTheDocument();

    release();
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByText('Detalhe do pedido')).not.toBeInTheDocument();
    expect(screen.getByText('Outra tela')).toBeInTheDocument();
  });

  test('trocar de importação com a confirmação pendente não leva ao pedido da anterior', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    server.use(
      http.get(`${API_URL}/nfe-imports/:id`, ({ params }) => HttpResponse.json({ data: { ...draft, id: String(params.id) } })),
      http.post(`${API_URL}/nfe-imports/:id/confirm`, async () => {
        await gate;
        return HttpResponse.json({ data: { importId: draft.id, purchaseId: 'pc-1' } }, { status: 201 });
      }),
    );
    renderWithProviders(
      <>
        <Link to="/nfe-imports/outra-nota">Abrir outra nota</Link>
        <Routes>
          <Route path="/nfe-imports/:id" element={<NfeImportReviewPage />} />
          <Route path="/purchases/:id" element={<div>Detalhe do pedido</div>} />
        </Routes>
      </>,
      { route: `/nfe-imports/${draft.id}` },
    );
    await screen.findByTestId('nfe-item-1');
    await prepareItem2AsNewProduct();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importação' }));
    await userEvent.click(screen.getByRole('link', { name: 'Abrir outra nota' }));
    await screen.findByTestId('nfe-item-1');

    release();
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByText('Detalhe do pedido')).not.toBeInTheDocument();
    expect(screen.getByTestId('nfe-item-1')).toBeInTheDocument();
  });

  test('o erro do servidor some do item assim que ele é corrigido', async () => {
    server.use(
      http.post(`${API_URL}/nfe-imports/:id/confirm`, () =>
        HttpResponse.json({ message: 'Item 3: Código de barras já cadastrado.', code: 'BARCODE_ALREADY_EXISTS' }, { status: 409 }),
      ),
    );
    renderPage();
    await screen.findByTestId('nfe-item-1');
    await prepareItem2AsNewProduct();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar importação' }));
    expect(await within(item(3)).findByText('Item 3: Código de barras já cadastrado.')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Ação do item 3'), 'createProduct');

    expect(screen.queryByText('Item 3: Código de barras já cadastrado.')).not.toBeInTheDocument();
  });

  test('valores usam MoneyInput/QuantityInput pt-BR, sem campo type=number', async () => {
    renderPage();
    await screen.findByTestId('nfe-item-1');
    await prepareItem2AsNewProduct();

    expect(document.querySelectorAll('input[type="number"]')).toHaveLength(0);

    // "1.000,50" é milhar + decimal; a soma mostra o valor correto
    await userEvent.clear(screen.getByLabelText('Valor da parcela 3'));
    await userEvent.type(screen.getByLabelText('Valor da parcela 3'), '1.000,50');
    expect(screen.getByTestId('installments-sum')).toHaveTextContent('R$ 1.265,22');

    // quantidade só aceita dígitos e tem botões −/+
    const upp = screen.getByLabelText('Unidades por embalagem do item 1');
    await userEvent.clear(upp);
    await userEvent.type(upp, 'a2b');
    expect(upp).toHaveValue('2');
    await userEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade de item 1' }));
    expect(upp).toHaveValue('3');
  });

  describe('desfazer importação (onda 7)', () => {
    const confirmedNote = { ...draft, status: 'CONFIRMED', purchaseId: purchaseDetail.data.id };

    function serveConfirmed(revert: (request: Request) => Response | Promise<Response>) {
      let reverted = false;
      const calls: { idempotencyKey: string | null }[] = [];
      server.use(
        http.get(`${API_URL}/nfe-imports/:id`, () => HttpResponse.json({ data: reverted ? { ...confirmedNote, status: 'REVERTED' } : confirmedNote })),
        http.post(`${API_URL}/nfe-imports/:id/revert`, async ({ request }) => {
          calls.push({ idempotencyKey: request.headers.get('Idempotency-Key') });
          const response = await revert(request);
          if (response.status === 200) reverted = true;
          return response;
        }),
      );
      return calls;
    }

    test('ADMIN: confirmação destrutiva com o resumo; desfeita, a nota aparece como Desfeita', async () => {
      const calls = serveConfirmed(() => HttpResponse.json({ data: { ...confirmedNote, status: 'REVERTED' } }));
      renderPage();

      await userEvent.click(await screen.findByRole('button', { name: 'Desfazer importação' }));
      const dialog = await screen.findByRole('dialog');
      // Resumo: itens e unidades que saem do estoque, valor do contas a pagar e o pedido.
      await waitFor(() => expect(dialog).toHaveTextContent('PC000012'));
      expect(dialog).toHaveTextContent('2 itens');
      expect(dialog).toHaveTextContent('1 unidade');
      expect(dialog).toHaveTextContent(/R\$\s30,75/);

      await userEvent.click(within(dialog).getByRole('button', { name: 'Desfazer importação' }));

      await waitFor(() => expect(calls).toHaveLength(1));
      expect(calls[0].idempotencyKey).toBeTruthy();
      expect(await screen.findByText(/Esta importação foi desfeita/)).toBeInTheDocument();
      expect(screen.getByText('Desfeita')).toHaveAttribute('data-status', 'REVERTED');
      expect(screen.queryByRole('button', { name: 'Desfazer importação' })).not.toBeInTheDocument();
    });

    test('409 NFE_REVERT_BLOCKED: mostra o motivo e a nota continua confirmada', async () => {
      serveConfirmed(() =>
        HttpResponse.json({ message: 'Itens desta nota já foram vendidos/baixados', code: 'NFE_REVERT_BLOCKED' }, { status: 409 }),
      );
      renderPage();

      await userEvent.click(await screen.findByRole('button', { name: 'Desfazer importação' }));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Desfazer importação' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Itens desta nota já foram vendidos/baixados');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByText('Esta nota já foi confirmada.', { exact: false })).toBeInTheDocument();
    });

    test('sem purchases.revert o botão não aparece', async () => {
      loginAs('ESTOQUISTA');
      serveConfirmed(() => HttpResponse.json({ data: confirmedNote }));
      renderPage();

      expect(await screen.findByText('Esta nota já foi confirmada.', { exact: false })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Desfazer importação' })).not.toBeInTheDocument();
    });
  });
});
