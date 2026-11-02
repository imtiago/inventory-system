import { afterEach, describe, expect, test } from 'vitest';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';

import { FinanceDetailPage } from '../FinanceDetailPage';
import { FinanceListPage } from '../FinanceListPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { loginAs, resetSession } from '@/test/auth';
import legacyDetail from '@/test/fixtures/finance/receivableDetailLegacy.json';
import legacyList from '@/test/fixtures/finance/receivableListLegacy.json';

afterEach(() => resetSession());

function renderDetail() {
  server.use(http.get(`${API_URL}/receivables/${legacyDetail.data.id}`, () => HttpResponse.json(legacyDetail)));

  return renderWithProviders(
    <Routes>
      <Route path="/receivables/:id" element={<FinanceDetailPage kind="receivable" />} />
    </Routes>,
    { route: `/receivables/${legacyDetail.data.id}` },
  );
}

describe('Conta a receber do caderninho — detalhe', () => {
  test('mostra a etiqueta Caderninho, "A combinar" e nenhum link de venda', async () => {
    loginAs('ADMIN');
    renderDetail();

    const parcel = await screen.findByTestId('parcel-1');
    expect(screen.getByText('Caderninho')).toBeInTheDocument();
    expect(within(parcel).getByText(/Vencimento A combinar/)).toBeInTheDocument();
    expect(within(parcel).queryByText(/\d{2}\/\d{2}\/\d{4}/)).toBeNull();
    expect(screen.queryByRole('link', { name: /Venda de origem/ })).toBeNull();
  });

  test('cabeçalho: documento só com saldo a combinar mostra "A combinar", não "A vencer"', async () => {
    loginAs('ADMIN');
    renderDetail();

    await screen.findByTestId('parcel-1');
    const header = screen.getByRole('heading', { level: 1 }).closest('header') ?? document.body;
    const badges = within(header as HTMLElement).getAllByText((_, el) => el?.getAttribute('data-status') === 'DUE_TO_AGREE');
    expect(badges[0]).toHaveTextContent('A combinar');
    expect(screen.queryByText('A vencer')).toBeNull();
  });

  test('parcela a combinar nunca usa o tom de vencida', async () => {
    loginAs('ADMIN');
    renderDetail();

    const parcel = await screen.findByTestId('parcel-1');
    expect(parcel.querySelector('[data-status="OVERDUE"]')).toBeNull();
    expect(within(parcel).getByText('A combinar', { selector: 'span' })).toHaveAttribute('data-status', 'DUE_TO_AGREE');
  });

  test('"Parcelar saldo" só com credit.manage e só na parcela a combinar', async () => {
    loginAs('ADMIN');
    const { unmount } = renderDetail();
    expect(await screen.findByRole('button', { name: 'Parcelar saldo' })).toBeInTheDocument();
    unmount();

    loginAs('VENDEDOR');
    renderDetail();
    await screen.findByTestId('parcel-1');
    expect(screen.queryByRole('button', { name: 'Parcelar saldo' })).toBeNull();
  });
});

describe('Contas a receber — lista com caderninho', () => {
  test('linha do caderninho tem a etiqueta e "A combinar" no lugar da data', async () => {
    loginAs('ADMIN');
    server.use(http.get(`${API_URL}/receivables`, () => HttpResponse.json(legacyList)));
    renderWithProviders(<FinanceListPage kind="receivable" />);

    const rows = await screen.findAllByText('Maria Oliveira');
    expect(rows.length).toBeGreaterThan(0);
    expect(screen.getAllByText('Caderninho').length).toBeGreaterThan(0);
    expect(screen.getAllByText('A combinar').length).toBeGreaterThan(0);
    expect(screen.queryByText('LEGACY')).toBeNull();
    // Só a linha do caderninho (saldo todo a combinar) troca "A vencer" por "A combinar"; a venda comum continua "A vencer".
    expect(screen.getAllByText('A combinar', { selector: '[data-status="DUE_TO_AGREE"]' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('A vencer', { selector: '[data-status="OPEN"]' }).length).toBeGreaterThan(0);
  });
});
