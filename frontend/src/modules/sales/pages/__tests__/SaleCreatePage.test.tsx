import { describe, expect, test, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';

import { SaleCreatePage } from '../SaleCreatePage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { loginAs } from '@/test/auth';
import { setViewport } from '@/test/viewport';
import saleDetail from '@/test/fixtures/sales/saleDetail.json';
import saleSimulation from '@/test/fixtures/sales/saleSimulation.json';
import businessRule from '@/test/fixtures/errors/businessRule.json';
import type { ISaleSimulationCrediario } from '../../types';

const customer = { id: 'c-1', name: 'Maria Oliveira', code: 'CLI-1' };
const priced = { id: 'v-1', name: 'Camiseta Azul', code: 'CAM-1', barcode: '111', productId: 'p-1', salePrice: 39.9 };
const unpriced = { id: 'v-2', name: 'Camiseta Sem Preço', code: 'CAM-2', barcode: '222', productId: 'p-1', salePrice: 0 };

type Posted = { customerId: string; items: unknown[]; payment: Record<string, unknown>; paymentTerms?: unknown };

let posts: { body: Posted; key: string | null }[] = [];
let simulations: Record<string, unknown>[] = [];


function useSimulation(crediario: Partial<ISaleSimulationCrediario>) {
  server.use(
    http.post(`${API_URL}/sales/simulate`, async ({ request }) => {
      simulations.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json({ data: { ...saleSimulation.data, crediario: { ...saleSimulation.data.crediario, ...crediario } } });
    }),
  );
}

beforeEach(() => {
  posts = [];
  simulations = [];
  server.use(
    http.get(`${API_URL}/customers`, () => HttpResponse.json({ data: [customer], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } })),
    http.get(`${API_URL}/variants/barcode/:code`, ({ params }) => {
      const v = params.code === '111' ? priced : unpriced;
      return HttpResponse.json({ data: v });
    }),
    http.post(`${API_URL}/sales/simulate`, async ({ request }) => {
      simulations.push((await request.json()) as Record<string, unknown>);
      return HttpResponse.json(saleSimulation);
    }),
    http.post(`${API_URL}/sales`, async ({ request }) => {
      posts.push({ body: (await request.json()) as Posted, key: request.headers.get('Idempotency-Key') });
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

/** Cliente + 1 item com preço, simulação carregada. */
async function readyToClose() {
  renderPage();
  await pickCustomer();
  await addBarcode('111');
  await screen.findByLabelText('Quantidade de Camiseta Azul');
  // Simulação carregada (fixture: itens 159,70).
  await waitFor(() => expect(screen.getByTestId('checkout-total')).toHaveTextContent('159,70'));
}

async function chooseCondition(name: 'Dinheiro' | 'PIX' | 'Débito' | 'Crédito' | 'Crediário') {
  await userEvent.click(screen.getByRole('radio', { name }));
}

async function register() {
  await userEvent.click(screen.getByRole('button', { name: /Registrar venda|Pedir autorização/ }));
}

describe('SaleCreatePage — carrinho', () => {
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

  test('campo de quantidade pode ser apagado e valida no envio', async () => {
    renderPage();
    await pickCustomer();
    await addBarcode('111');

    const qty = await screen.findByLabelText('Quantidade de Camiseta Azul');
    await userEvent.clear(qty);
    expect(qty).toHaveValue('');

    await register();
    expect(await screen.findByText(/quantidade válida/i)).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });
});

describe('SaleCreatePage — fechamento', () => {
  test('simula com cliente e itens; mostra à vista × total da condição', async () => {
    await readyToClose();

    expect(simulations[0]).toMatchObject({ customerId: 'c-1', items: [{ productVariantId: 'v-1', quantity: 1 }] });
    const summary = screen.getByTestId('checkout-summary');
    expect(within(summary).getByText('À vista')).toBeInTheDocument();
    expect(within(summary).getAllByText(/159,70/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('checkout-total')).toHaveTextContent('159,70');
  });

  test('as cinco condições aparecem; Dinheiro é o padrão e envia payment.condition CASH com chave', async () => {
    await readyToClose();

    for (const name of ['Dinheiro', 'PIX', 'Débito', 'Crédito', 'Crediário']) {
      expect(screen.getByRole('radio', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('radio', { name: 'Dinheiro' })).toBeChecked();

    await register();
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].body.payment).toEqual({ condition: 'CASH' });
    expect(posts[0].body.paymentTerms).toBeUndefined();
    expect(posts[0].key).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
  });

  test('PIX envia condition PIX', async () => {
    await readyToClose();
    await chooseCondition('PIX');
    await register();
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].body.payment).toEqual({ condition: 'PIX' });
  });

  test('débito: "Repassar taxa ao cliente" ligado por padrão com o valor final; desligar volta ao preço e envia passCardFee false', async () => {
    await readyToClose();
    await chooseCondition('Débito');

    const toggle = screen.getByRole('switch', { name: 'Repassar taxa ao cliente' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('checkout-total')).toHaveTextContent('162,95');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByTestId('checkout-total')).toHaveTextContent('159,70');

    await register();
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].body.payment).toEqual({ condition: 'DEBIT_CARD', passCardFee: false });
  });

  test('crédito: escolhe 1x–12x, mostra o valor final com repasse e envia cardInstallments', async () => {
    await readyToClose();
    await chooseCondition('Crédito');

    const select = screen.getByLabelText('Parcelas no cartão');
    expect(within(select).getAllByRole('option')).toHaveLength(12);
    await userEvent.selectOptions(select, '3');
    expect(screen.getByTestId('checkout-total')).toHaveTextContent('168,09');

    await register();
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].body.payment).toEqual({ condition: 'CREDIT_CARD', cardInstallments: 3, passCardFee: true });
  });

  test('margem por condição aparece só para quem vê lucro (ADMIN)', async () => {
    await readyToClose();
    expect(screen.getByTestId('checkout-margin')).toHaveTextContent('62,40');
  });

  test('VENDEDOR não vê margem', async () => {
    loginAs('VENDEDOR');
    await readyToClose();
    expect(screen.queryByTestId('checkout-margin')).not.toBeInTheDocument();
    expect(screen.queryByText(/margem/i)).not.toBeInTheDocument();
  });

  test('erro do backend aparece uma única vez', async () => {
    server.use(http.post(`${API_URL}/sales`, () => HttpResponse.json(businessRule, { status: 422 })));
    await readyToClose();
    await register();

    await screen.findByText('Estoque disponível insuficiente.');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getAllByText('Estoque disponível insuficiente.')).toHaveLength(1);
  });

  test('EXPIRED_STOCK_ONLY: a mensagem do backend aparece no item da venda (uma única vez)', async () => {
    const message = 'Estoque insuficiente para Camiseta Azul: 2 disponível(is) dentro da validade; 5 vencida(s) — dê baixa manual dos vencidos.';
    server.use(
      http.post(`${API_URL}/sales`, () =>
        HttpResponse.json({ message, code: 'EXPIRED_STOCK_ONLY', details: { productVariantId: 'v-1', available: 2, expired: 5 } }, { status: 409 }),
      ),
    );
    await readyToClose();
    await register();

    const inItem = await screen.findByTestId('item-error-v-1');
    expect(inItem).toHaveTextContent(message);
    expect(screen.getAllByText(message)).toHaveLength(1);
  });

  test('idempotência: a mesma chave em nova tentativa com os mesmos dados; nova chave quando a condição muda', async () => {
    let fail = true;
    server.use(
      http.post(`${API_URL}/sales`, async ({ request }) => {
        posts.push({ body: (await request.json()) as Posted, key: request.headers.get('Idempotency-Key') });
        if (fail) return HttpResponse.json({ message: 'Falha temporária.', code: 'INTERNAL_ERROR' }, { status: 500 });
        return HttpResponse.json(saleDetail, { status: 201 });
      }),
    );
    await readyToClose();

    await register();
    await screen.findByText('Falha temporária.');
    await register();
    await waitFor(() => expect(posts).toHaveLength(2));
    expect(posts[1].key).toBe(posts[0].key);

    await chooseCondition('PIX');
    fail = false;
    await register();
    await waitFor(() => expect(posts).toHaveLength(3));
    expect(posts[2].key).not.toBe(posts[0].key);
  });

  test('sucesso navega para /sales/:id da venda criada', async () => {
    await readyToClose();
    await register();
    expect(await screen.findByText('Detalhe da venda')).toBeInTheDocument();
  });
});

describe('SaleCreatePage — crediário', () => {
  test('mostra a ficha do cliente (perfil, limite, disponível), entrada mínima, dia do vencimento e as opções', async () => {
    await readyToClose();
    await chooseCondition('Crediário');

    const panel = await screen.findByTestId('customer-credit-panel');
    expect(within(panel).getByText('Bom')).toBeInTheDocument();
    expect(within(panel).getByText(/2\.000,00/)).toBeInTheDocument();
    expect(within(panel).getByText(/1\.880,00/)).toBeInTheDocument();

    expect(screen.getByLabelText('Entrada')).toBeInTheDocument();
    expect(screen.getByText(/Entrada mínima: R\$\s47,91/)).toBeInTheDocument();
    const dueDay = screen.getByLabelText('Dia do vencimento');
    // "Padrão" + 1..28
    expect(within(dueDay).getAllByRole('option')).toHaveLength(29);

    const table = screen.getByRole('table', { name: 'Opções do crediário' });
    expect(within(table).getAllByRole('radio')).toHaveLength(2);
    expect(within(table).getByRole('columnheader', { name: 'Margem' })).toBeInTheDocument();
  });

  test('envia o plano escolhido com entrada, forma da entrada e dia do vencimento', async () => {
    await readyToClose();
    await chooseCondition('Crediário');
    await screen.findByRole('table', { name: 'Opções do crediário' });

    await userEvent.selectOptions(screen.getByLabelText('Forma da entrada'), 'PIX');
    await userEvent.selectOptions(screen.getByLabelText('Dia do vencimento'), '10');
    await userEvent.click(screen.getByRole('radio', { name: /2x de R\$\s55,90/ }));
    expect(screen.getByTestId('checkout-total')).toHaveTextContent('159,70');

    await register();
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].body.payment).toEqual({
      condition: 'CREDIARIO',
      crediario: { installments: 2, downPayment: 47.91, downPaymentMethod: 'PIX', dueDay: 10 },
    });
  });

  test('entrada digitada vai para a simulação; abaixo da mínima mostra erro e não envia', async () => {
    await readyToClose();
    await chooseCondition('Crediário');
    await screen.findByRole('table', { name: 'Opções do crediário' });

    const input = screen.getByLabelText('Entrada');
    await userEvent.type(input, '60,00');
    await waitFor(() => expect(simulations.some((s) => s.downPayment === 60)).toBe(true));

    await userEvent.clear(input);
    await userEvent.type(input, '10');
    await userEvent.click(screen.getByRole('radio', { name: /1x de/ }));
    await register();
    expect(await screen.findByText('A entrada mínima é R$ 47,91.')).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  test('enquanto a simulação da nova entrada não volta, o botão fica desabilitado (sem enviar plano antigo)', async () => {
    await readyToClose();
    await chooseCondition('Crediário');
    await screen.findByRole('table', { name: 'Opções do crediário' });
    await userEvent.click(screen.getByRole('radio', { name: /1x de/ }));
    const button = screen.getByRole('button', { name: /Registrar venda|Pedir autorização/ });
    expect(button).toBeEnabled();

    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${API_URL}/sales/simulate`, async ({ request }) => {
        simulations.push((await request.json()) as Record<string, unknown>);
        await pending;
        return HttpResponse.json(saleSimulation);
      }),
    );
    await userEvent.type(screen.getByLabelText('Entrada'), '60,00');
    await waitFor(() => expect(simulations.some((s) => s.downPayment === 60)).toBe(true));
    expect(button).toBeDisabled();
    release();
    await waitFor(() => expect(button).toBeEnabled());
  });

  test('escolher uma opção é obrigatório', async () => {
    await readyToClose();
    await chooseCondition('Crediário');
    await screen.findByRole('table', { name: 'Opções do crediário' });
    await register();
    expect(await screen.findByText('Escolha o número de parcelas do crediário.')).toBeInTheDocument();
    expect(posts).toHaveLength(0);
  });

  test('crediário desligado: aviso claro, opções indisponíveis e sem envio', async () => {
    useSimulation({ allowed: false, blockedReason: 'DISABLED' });
    await readyToClose();
    await chooseCondition('Crediário');

    expect(await screen.findByText('O crediário ainda não foi ativado nas configurações.')).toBeInTheDocument();
    for (const radio of within(screen.getByRole('table', { name: 'Opções do crediário' })).getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: 'Registrar venda' })).toBeDisabled();
  });

  test('opção acima do disponível fica marcada com o motivo; escolhê-la pede autorização (aprovador, senha, motivo) e envia override', async () => {
    useSimulation({ available: 100 });
    await readyToClose();
    await chooseCondition('Crediário');

    const table = await screen.findByRole('table', { name: 'Opções do crediário' });
    expect(within(table).getAllByText('Acima do disponível')).toHaveLength(2);

    await userEvent.click(screen.getByRole('radio', { name: /1x de/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Pedir autorização' }));

    const dialog = await screen.findByRole('dialog', { name: 'Autorização de crédito' });
    await userEvent.selectOptions(await within(dialog).findByLabelText('Quem autoriza'), 'ana@loja.com.br');
    const password = within(dialog).getByLabelText('Senha de quem autoriza');
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'off');
    await userEvent.type(password, 'segredo123');
    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'Cliente antiga, paga em dia');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Autorizar e registrar' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].body.payment.override).toEqual({ approverEmail: 'ana@loja.com.br', approverPassword: 'segredo123', reason: 'Cliente antiga, paga em dia' });
    expect(await screen.findByText('Detalhe da venda')).toBeInTheDocument();
  });

  test('422 CREDIT_LIMIT_EXCEEDED abre a autorização; senha errada (403) fica no modal e a nova tentativa usa a mesma chave', async () => {
    let call = 0;
    server.use(
      http.post(`${API_URL}/sales`, async ({ request }) => {
        posts.push({ body: (await request.json()) as Posted, key: request.headers.get('Idempotency-Key') });
        call++;
        if (call === 1) return HttpResponse.json({ message: 'Limite de crédito insuficiente.', code: 'CREDIT_LIMIT_EXCEEDED', details: { available: 50, required: 111.79 } }, { status: 422 });
        if (call === 2) return HttpResponse.json({ message: 'Autorização recusada.', code: 'CREDIT_OVERRIDE_DENIED' }, { status: 403 });
        return HttpResponse.json(saleDetail, { status: 201 });
      }),
    );
    await readyToClose();
    await chooseCondition('Crediário');
    await screen.findByRole('table', { name: 'Opções do crediário' });
    await userEvent.click(screen.getByRole('radio', { name: /1x de/ }));
    await register();

    const dialog = await screen.findByRole('dialog', { name: 'Autorização de crédito' });
    expect(within(dialog).getByText('Limite de crédito insuficiente.')).toBeInTheDocument();
    await userEvent.selectOptions(await within(dialog).findByLabelText('Quem autoriza'), 'ana@loja.com.br');
    await userEvent.type(within(dialog).getByLabelText('Senha de quem autoriza'), 'errada');
    await userEvent.type(within(dialog).getByLabelText('Motivo'), 'Cliente antiga');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Autorizar e registrar' }));

    expect(await within(dialog).findByText('Autorização recusada.')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Autorizar e registrar' }));
    await waitFor(() => expect(posts).toHaveLength(3));
    expect(posts[2].key).toBe(posts[1].key);
  });

  test('atraso: aviso de parcela em atraso e o botão pede autorização', async () => {
    useSimulation({ allowed: false, blockedReason: 'OVERDUE' });
    await readyToClose();
    await chooseCondition('Crediário');

    expect(await screen.findByText(/Cliente com parcela em atraso/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /1x de/ }));
    expect(screen.getByRole('button', { name: 'Pedir autorização' })).toBeEnabled();
  });

  test('VENDEDOR não vê a coluna de margem', async () => {
    loginAs('VENDEDOR');
    await readyToClose();
    await chooseCondition('Crediário');
    const table = await screen.findByRole('table', { name: 'Opções do crediário' });
    expect(within(table).queryByRole('columnheader', { name: 'Margem' })).not.toBeInTheDocument();
  });

  test('no celular as opções viram cartões e o total fica numa barra fixa', async () => {
    setViewport(375);
    await readyToClose();
    await chooseCondition('Crediário');

    const list = await screen.findByRole('radiogroup', { name: 'Opções do crediário' });
    expect(within(list).getAllByRole('radio')).toHaveLength(2);
    expect(screen.queryByRole('table', { name: 'Opções do crediário' })).not.toBeInTheDocument();
    expect(screen.getByTestId('checkout-bar')).toHaveClass('sticky');
  });
});
