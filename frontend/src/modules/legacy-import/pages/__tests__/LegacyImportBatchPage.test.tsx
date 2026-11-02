import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';

import { LegacyImportBatchPage } from '../LegacyImportBatchPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { resetViewport, setViewport } from '@/test/viewport';
import reviewFixture from '@/test/fixtures/legacy-import/legacyBatchReview.json';
import confirmedFixture from '@/test/fixtures/legacy-import/legacyBatchConfirmed.json';
import type { LegacyBatch } from '../../types';

type Batch = LegacyBatch;
const review = reviewFixture.data as unknown as Batch;
const confirmed = confirmedFixture.data as unknown as Batch;
const rowId = (line: number) => review.rows.find((r) => r.line === line)!.id;

/** Lote sem erro nem nome parecido pendente (só a linha da Maria e a da Carla). */
function cleanBatch(): Batch {
  const rows = review.rows.filter((r) => r.line === 2 || r.line === 5);
  return { ...review, rows, summary: { ...review.summary, rows: 2, warnings: 1, errors: 0, ignored: 0, newCustomers: 1, existingCustomers: 1, openTotal: 1400 } };
}

let current: Batch;
let patches: { rowId: string; body: unknown }[];

function renderPage(batch: Batch = review) {
  current = structuredClone(batch);
  patches = [];
  server.use(
    http.get(`${API_URL}/legacy-imports/:id`, () => HttpResponse.json({ data: current })),
    http.patch(`${API_URL}/legacy-imports/:id/rows/:rowId`, async ({ params, request }) => {
      patches.push({ rowId: params.rowId as string, body: await request.json() });
      return HttpResponse.json({ data: current });
    }),
  );
  return renderWithProviders(
    <Routes>
      <Route path="/finance/legacy-imports/:id" element={<LegacyImportBatchPage />} />
      <Route path="/finance/legacy-imports" element={<div>Lista de lotes</div>} />
      <Route path="/finance/legacy-imports/:id/quick" element={<div>Lançamento rápido do lote</div>} />
    </Routes>,
    { route: `/finance/legacy-imports/${batch.id}` },
  );
}

function rowOf(line: number): HTMLElement {
  return screen.getByTestId(`legacy-row-${line}`);
}

beforeEach(() => {
  patches = [];
});

afterEach(() => resetViewport());

describe('LegacyImportBatchPage — revisão', () => {
  test('mostra a etapa atual, o resumo e a situação de cada linha com o tom do mapa único', async () => {
    renderPage();

    expect(await screen.findByText('caderno-loja.csv')).toBeInTheDocument();
    expect(screen.getByText('Revisar').closest('li')).toHaveAttribute('aria-current', 'step');

    const summary = screen.getByRole('region', { name: 'Resumo do lote' });
    expect(within(summary).getByTestId('summary-new')).toHaveTextContent('4');
    expect(within(summary).getByTestId('summary-existing')).toHaveTextContent('1');
    expect(within(summary).getByTestId('summary-open')).toHaveTextContent('R$ 2.400,50');
    expect(within(summary).getByTestId('summary-warnings')).toHaveTextContent('3');
    expect(within(summary).getByTestId('summary-errors')).toHaveTextContent('1');

    expect(within(rowOf(4)).getByText('Erro')).toHaveAttribute('data-status', 'ERROR');
    expect(within(rowOf(5)).getByText('OK')).toHaveAttribute('data-status', 'OK');
    expect(within(rowOf(2)).getByText('Aviso')).toHaveAttribute('data-status', 'WARNING');
    expect(within(rowOf(7)).getByText('Ignorada')).toHaveAttribute('data-status', 'IGNORED');
    // Avisos legíveis em PT (mensagens do servidor).
    expect(within(rowOf(4)).getByText('O valor pago é maior que o total.')).toBeInTheDocument();
    expect(within(rowOf(6)).getByText('Sem data da compra.')).toBeInTheDocument();
  });

  test('filtro "só com aviso ou erro" esconde linhas OK e ignoradas', async () => {
    renderPage();
    await screen.findByText('caderno-loja.csv');
    expect(screen.getByText('Carla Mendes')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Só com aviso ou erro' }));

    expect(screen.queryByText('Carla Mendes')).not.toBeInTheDocument();
    expect(screen.queryByText('Pedro')).not.toBeInTheDocument();
    expect(screen.getByText('Ana Lima')).toBeInTheDocument();
  });

  test('vínculo automático por nome igual aparece claro e pode virar "criar novo"', async () => {
    renderPage();
    await screen.findByText('caderno-loja.csv');

    const row = rowOf(2);
    expect(within(row).getByText('Vinculado automaticamente a Maria Silva — confira')).toBeInTheDocument();
    await userEvent.click(within(row).getByRole('button', { name: 'Criar novo' }));

    await waitFor(() => expect(patches).toEqual([{ rowId: rowId(2), body: { customerAction: { kind: 'NEW' } } }]));
  });

  test('vínculo escolhido pela usuária não aparece como automático (usa autoLinked, não o nome)', async () => {
    const batch = structuredClone(review);
    const chosen = batch.rows.find((r) => r.line === 2)!;
    chosen.autoLinked = false;
    renderPage(batch);
    await screen.findByText('caderno-loja.csv');

    const row = rowOf(2);
    expect(within(row).getByText('Vinculado a Maria Silva')).toBeInTheDocument();
    expect(within(row).queryByText(/automaticamente/)).not.toBeInTheDocument();
  });

  test('vínculo automático sem sugestão na lista ainda mostra "confira" com o nome da linha', async () => {
    const batch = structuredClone(review);
    const auto = batch.rows.find((r) => r.line === 2)!;
    auto.suggestions = [];
    renderPage(batch);
    await screen.findByText('caderno-loja.csv');

    expect(within(rowOf(2)).getByText('Vinculado automaticamente a Maria Silva — confira')).toBeInTheDocument();
  });

  test('cliente vinculado apagado aparece na revisão (erro da linha) com "Criar novo"', async () => {
    const batch = structuredClone(review);
    const gone = batch.rows.find((r) => r.line === 2)!;
    gone.status = 'ERROR';
    gone.autoLinked = false;
    gone.customerId = null;
    gone.suggestions = [];
    gone.issues = [
      { code: 'LINKED_CUSTOMER_MISSING', severity: 'ERROR', field: 'nome', message: 'O cliente vinculado não existe mais (foi excluído). Escolha "Criar novo" ou vincule outro cliente.' },
    ];
    renderPage(batch);
    await screen.findByText('caderno-loja.csv');

    const row = rowOf(2);
    expect(within(row).getByText('Cliente vinculado foi excluído')).toBeInTheDocument();
    expect(within(row).queryByText(/Vinculado a/)).not.toBeInTheDocument();
    await userEvent.click(within(row).getByRole('button', { name: 'Criar novo' }));
    await waitFor(() => expect(patches).toEqual([{ rowId: rowId(2), body: { customerAction: { kind: 'NEW' } } }]));
  });

  test('editor mostra o texto digitado na planilha quando o valor é inválido', async () => {
    const batch = structuredClone(review);
    const bad = batch.rows.find((r) => r.line === 4)!;
    bad.raw = { ...bad.raw, valor_pago: '15O,00', data_compra: '31/02/2026', celular: '123', perfil: 'Ótimo', vencimentos: '10/12/2026=x' };
    bad.data = { ...bad.data, paid: 0, purchaseDate: null, phone: null, profileCode: null };
    bad.issues = [
      { code: 'INVALID_AMOUNT', severity: 'ERROR', field: 'valor_pago', message: 'Valor pago inválido. Use o formato 1.234,56.' },
      { code: 'INVALID_DATE', severity: 'ERROR', field: 'data_compra', message: 'Data inválida. Use dd/mm/aaaa.' },
      { code: 'INVALID_PHONE', severity: 'WARNING', field: 'celular', message: 'Celular inválido (use DDD + número).' },
      { code: 'UNKNOWN_PROFILE', severity: 'ERROR', field: 'perfil', message: 'Perfil desconhecido. Use Novo, Regular, Bom ou Excelente.' },
      { code: 'INVALID_DUE_DATES', severity: 'ERROR', field: 'vencimentos', message: 'Vencimentos inválidos.' },
    ];
    renderPage(batch);
    await screen.findByText('caderno-loja.csv');

    await userEvent.click(within(rowOf(4)).getByRole('button', { name: 'Editar' }));
    const editor = screen.getByRole('form', { name: 'Editar linha 4' });
    expect(within(editor).getByLabelText('Valor pago')).toHaveValue('15O,00');
    expect(within(editor).getByLabelText('Celular')).toHaveValue('123');
    expect(within(editor).getByText('Na planilha: 31/02/2026')).toBeInTheDocument();
    expect(within(editor).getByText('Na planilha: Ótimo')).toBeInTheDocument();
    expect(within(editor).getByText('Na planilha: 10/12/2026=x')).toBeInTheDocument();
    // Sem mexer, nada é enviado: o valor digitado só aparece para corrigir.
    await userEvent.click(within(editor).getByRole('button', { name: 'Salvar linha' }));
    expect(patches).toEqual([]);
  });

  test('nome parecido com cliente: vincular ao existente ou criar novo', async () => {
    renderPage();
    await screen.findByText('caderno-loja.csv');

    const row = rowOf(3);
    await userEvent.click(within(row).getByRole('button', { name: 'É a mesma pessoa: João de Souza' }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ rowId: rowId(3), body: { customerAction: { kind: 'LINK', customerId: review.rows[1].suggestions[0].customerId } } });

    await userEvent.click(within(rowOf(3)).getByRole('button', { name: 'Criar novo' }));
    await waitFor(() => expect(patches).toHaveLength(2));
    expect(patches[1].body).toEqual({ customerAction: { kind: 'NEW' } });
  });

  test('nome parecido com outra linha: juntar com a linha', async () => {
    renderPage();
    await screen.findByText('caderno-loja.csv');

    await userEvent.click(within(rowOf(6)).getByRole('button', { name: 'É a mesma pessoa: Maria Silva (linha 2)' }));

    await waitFor(() => expect(patches).toEqual([{ rowId: rowId(6), body: { customerAction: { kind: 'SAME_AS_ROW', rowId: rowId(2) } } }]));
  });

  test('ignorar e restaurar linha', async () => {
    renderPage();
    await screen.findByText('caderno-loja.csv');

    await userEvent.click(within(rowOf(4)).getByRole('button', { name: 'Ignorar linha' }));
    await waitFor(() => expect(patches[0]).toEqual({ rowId: rowId(4), body: { ignored: true } }));

    await userEvent.click(within(rowOf(7)).getByRole('button', { name: 'Restaurar linha' }));
    await waitFor(() => expect(patches[1]).toEqual({ rowId: rowId(7), body: { ignored: false } }));
  });

  test('edição na própria linha envia só os campos alterados', async () => {
    renderPage();
    await screen.findByText('caderno-loja.csv');

    await userEvent.click(within(rowOf(4)).getByRole('button', { name: 'Editar' }));
    const editor = screen.getByRole('form', { name: 'Editar linha 4' });
    // Todos os campos da linha.
    for (const label of ['Nome', 'Celular', 'Data da compra', 'Descrição', 'Valor total', 'Valor pago', 'Perfil', 'Observação']) {
      expect(within(editor).getByLabelText(label)).toBeInTheDocument();
    }
    expect(within(editor).getByText('Vencimentos')).toBeInTheDocument();
    // O erro da linha aparece junto do campo.
    expect(within(editor).getByLabelText('Valor pago')).toHaveAttribute('aria-invalid', 'true');

    const paid = within(editor).getByLabelText('Valor pago');
    await userEvent.clear(paid);
    await userEvent.type(paid, '40,00');
    await userEvent.selectOptions(within(editor).getByLabelText('Perfil'), 'GOOD');
    await userEvent.click(within(editor).getByRole('button', { name: 'Salvar linha' }));

    await waitFor(() => expect(patches).toEqual([{ rowId: rowId(4), body: { data: { paid: 40, profileCode: 'GOOD' } } }]));
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Editar linha 4' })).not.toBeInTheDocument());
  });

  test('vencimentos editáveis: adicionar e enviar a lista', async () => {
    renderPage();
    await screen.findByText('caderno-loja.csv');

    await userEvent.click(within(rowOf(5)).getByRole('button', { name: 'Editar' }));
    const editor = screen.getByRole('form', { name: 'Editar linha 5' });
    expect(within(editor).getByLabelText('Valor do vencimento 2')).toHaveValue('300,00');
    await userEvent.click(within(editor).getByRole('button', { name: 'Remover vencimento 2' }));
    const amount = within(editor).getByLabelText('Valor do vencimento 1');
    await userEvent.clear(amount);
    await userEvent.type(amount, '600,00');
    await userEvent.click(within(editor).getByRole('button', { name: 'Salvar linha' }));

    await waitFor(() => expect(patches).toEqual([{ rowId: rowId(5), body: { data: { dueDates: [{ date: '2026-11-10', amount: 600 }] } } }]));
  });

  test('confirmar fica bloqueado com erro ou nome parecido pendente e lista o motivo', async () => {
    renderPage();
    await screen.findByText('caderno-loja.csv');

    expect(screen.getByRole('button', { name: 'Confirmar lote' })).toBeDisabled();
    const blocked = screen.getByTestId('confirm-blockers');
    expect(blocked).toHaveTextContent('Corrija ou ignore as linhas com erro: 4');
    expect(blocked).toHaveTextContent('Decida os nomes parecidos: linhas 3, 6');
  });

  test('confirmar mostra o que vai acontecer e envia a regra de limite com chave de idempotência', async () => {
    const calls: { key: string | null; body: unknown }[] = [];
    server.use(
      http.post(`${API_URL}/legacy-imports/:id/confirm`, async ({ request }) => {
        calls.push({ key: request.headers.get('Idempotency-Key'), body: await request.json() });
        current = confirmed;
        return HttpResponse.json({ data: confirmed });
      }),
    );
    const { queryClient } = renderPage(cleanBatch());
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await screen.findByText('caderno-loja.csv');

    expect(screen.getByRole('radio', { name: /O maior entre o limite do perfil e o saldo/ })).toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: /Só o limite do perfil/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar lote' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('2 dívidas');
    expect(dialog).toHaveTextContent('1 cliente novo');
    expect(dialog).toHaveTextContent('1 cliente existente');
    expect(dialog).toHaveTextContent('R$ 1.400,00');
    expect(dialog).toHaveTextContent('sem multa e sem juros');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar lote' }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0].key).toBeTruthy();
    expect(calls[0].body).toEqual({ limitRule: 'PROFILE_ONLY' });
    expect(await screen.findByRole('button', { name: 'Desfazer lote' })).toBeInTheDocument();
    const keys = invalidate.mock.calls.map(([arg]) => JSON.stringify(arg?.queryKey));
    for (const key of ['["receivables"]', '["customers"]', '["dashboard"]', '["legacy-imports"]']) expect(keys).toContain(key);
  });

  test('erro 422 na confirmação mostra a mensagem do servidor com as linhas', async () => {
    server.use(
      http.post(`${API_URL}/legacy-imports/:id/confirm`, () =>
        HttpResponse.json({ message: 'Decida se os nomes parecidos são a mesma pessoa.', code: 'UNRESOLVED_SIMILAR_NAMES', details: { lines: [5] } }, { status: 422 }),
      ),
    );
    renderPage(cleanBatch());
    await screen.findByText('caderno-loja.csv');

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar lote' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar lote' }));

    const alert = await screen.findByTestId('confirm-error');
    expect(alert).toHaveTextContent('Decida se os nomes parecidos são a mesma pessoa.');
    expect(alert).toHaveTextContent('Linhas: 5');
  });

  test('cliente vinculado apagado: mostra o erro e oferece criar novo', async () => {
    server.use(
      http.post(`${API_URL}/legacy-imports/:id/confirm`, () =>
        HttpResponse.json({ message: 'Cliente vinculado não existe mais (linha 2). Revise o vínculo.', code: 'CUSTOMER_NOT_FOUND', details: { lines: [2] } }, { status: 404 }),
      ),
    );
    renderPage(cleanBatch());
    await screen.findByText('caderno-loja.csv');

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar lote' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar lote' }));

    const alert = await screen.findByTestId('confirm-error');
    expect(alert).toHaveTextContent('Cliente vinculado não existe mais (linha 2). Revise o vínculo.');
    await userEvent.click(within(alert).getByRole('button', { name: 'Criar cliente novo na linha 2' }));

    await waitFor(() => expect(patches).toEqual([{ rowId: rowId(2), body: { customerAction: { kind: 'NEW' } } }]));
  });

  test('editar linha vinculada a cliente apagado: mostra o erro e oferece criar novo', async () => {
    renderPage();
    server.use(
      http.patch(`${API_URL}/legacy-imports/:id/rows/:rowId`, async ({ params, request }) => {
        const body = (await request.json()) as { data?: unknown };
        patches.push({ rowId: params.rowId as string, body });
        if (body.data) return HttpResponse.json({ message: 'Cliente não encontrado.', code: 'CUSTOMER_NOT_FOUND' }, { status: 404 });
        return HttpResponse.json({ data: current });
      }),
    );
    await screen.findByText('caderno-loja.csv');

    await userEvent.click(within(rowOf(2)).getByRole('button', { name: 'Editar' }));
    const editor = screen.getByRole('form', { name: 'Editar linha 2' });
    await userEvent.type(within(editor).getByLabelText('Celular'), '11999998888');
    await userEvent.click(within(editor).getByRole('button', { name: 'Salvar linha' }));

    const alert = await within(editor).findByRole('alert');
    expect(alert).toHaveTextContent('Cliente não encontrado.');
    expect(alert).toHaveTextContent('O cliente vinculado pode ter sido excluído');
    await userEvent.click(within(alert).getByRole('button', { name: 'Criar cliente novo' }));

    await waitFor(() => expect(patches.at(-1)).toEqual({ rowId: rowId(2), body: { customerAction: { kind: 'NEW' } } }));
  });

  test('rascunho oferece lançamento rápido neste lote', async () => {
    renderPage();
    await screen.findByText('caderno-loja.csv');

    expect(screen.getByRole('link', { name: 'Lançamento rápido' })).toHaveAttribute('href', `/finance/legacy-imports/${review.id}/quick`);
  });

  test('no celular cada linha é um cartão que expande com os campos', async () => {
    setViewport(375, { pointer: 'coarse' });
    renderPage();
    await screen.findByText('caderno-loja.csv');

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const card = rowOf(4);
    expect(within(card).queryByLabelText('Valor pago')).not.toBeInTheDocument();
    await userEvent.click(within(card).getByRole('button', { name: 'Editar' }));
    expect(within(rowOf(4)).getByLabelText('Valor pago')).toBeInTheDocument();
  });
});

describe('LegacyImportBatchPage — lote confirmado', () => {
  test('mostra o resultado com links e desfaz com ConfirmDialog e chave de idempotência', async () => {
    const keys: (string | null)[] = [];
    server.use(
      http.post(`${API_URL}/legacy-imports/:id/revert`, ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'));
        if (keys.length === 1) return HttpResponse.json({ message: 'Alguma dívida deste lote já recebeu pagamento.', code: 'LEGACY_BATCH_HAS_PAYMENTS' }, { status: 409 });
        current = { ...confirmed, status: 'REVERTED', revertedAt: '2026-11-01T15:00:00.000Z' };
        return HttpResponse.json({ data: current });
      }),
    );
    renderPage(confirmed);

    expect(await screen.findByText(/Lote confirmado em/)).toBeInTheDocument();
    expect(screen.getByText('Confirmar').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.queryByRole('button', { name: 'Confirmar lote' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(within(rowOf(2)).getByRole('link', { name: 'Ver dívida' })).toHaveAttribute('href', `/receivables/${confirmed.rows[0].financialDocumentId}`);
    expect(within(rowOf(2)).getByRole('link', { name: 'Ver cliente' })).toHaveAttribute('href', `/customers/${confirmed.rows[0].customerId}`);

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer lote' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Os clientes continuam cadastrados');
    expect(dialog).toHaveTextContent('já recebeu pagamento');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Desfazer lote' }));

    expect(await screen.findByTestId('revert-error')).toHaveTextContent('Alguma dívida deste lote já recebeu pagamento.');

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer lote' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Desfazer lote' }));

    expect(await screen.findByText(/Lote desfeito em/)).toBeInTheDocument();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });
});
