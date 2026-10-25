import { describe, expect, test } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { SaleListPage } from '../SaleListPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import { todayInBusinessTz } from '@/shared/utils/businessDate';
import saleList from '@/test/fixtures/sales/saleList.json';

function trackList() {
  const urls: URL[] = [];
  server.use(
    http.get(`${API_URL}/sales`, ({ request }) => {
      urls.push(new URL(request.url));
      return HttpResponse.json(saleList);
    }),
  );
  return urls;
}

describe('SaleListPage: período e status na lista', () => {
  test('a lista pede GET /sales com o mês atual por padrão, os mesmos valores da exportação, sem o aviso antigo', async () => {
    const urls = trackList();
    renderWithProviders(<SaleListPage />);
    const today = todayInBusinessTz();

    await waitFor(() => expect(urls.length).toBeGreaterThan(0));
    expect(urls[0].searchParams.get('from')).toBe(`${today.slice(0, 8)}01`);
    expect(urls[0].searchParams.get('to')).toBe(today);
    expect(screen.queryByText(/a lista mostra todas as vendas/i)).not.toBeInTheDocument();
  });

  test('mudar período e status refaz a consulta, volta para a página 1 e mantém a exportação em sincronia', async () => {
    const urls = trackList();
    renderWithProviders(<SaleListPage />);
    await screen.findByText(/Vendas \(/);

    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2026-01-01' } });
    await waitFor(() => expect(urls[urls.length - 1].searchParams.get('from')).toBe('2026-01-01'));

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'CANCELED');
    await waitFor(() => {
      const last = urls[urls.length - 1];
      expect(last.searchParams.get('status')).toBe('CANCELED');
      expect(last.searchParams.get('from')).toBe('2026-01-01');
      expect(last.searchParams.get('page')).toBe('1');
    });
  });

  test('período inválido não consulta a lista', async () => {
    const urls = trackList();
    renderWithProviders(<SaleListPage />);
    await waitFor(() => expect(urls).toHaveLength(1));

    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2020-01-01' } });
    expect(screen.getByText('O período deve ter no máximo 366 dias.')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(urls).toHaveLength(1);
  });

  test('período inválido não mostra as linhas do período anterior nem o estado vazio', async () => {
    trackList();
    renderWithProviders(<SaleListPage />);
    expect(await screen.findByText('Maria Oliveira')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('De'), { target: { value: '2020-01-01' } });

    expect(screen.getByText('O período deve ter no máximo 366 dias.')).toBeInTheDocument();
    expect(screen.queryByText('Maria Oliveira')).not.toBeInTheDocument();
    expect(screen.queryByText(/nenhum/i)).not.toBeInTheDocument();
  });

  test('data inicial depois da final também esconde as linhas e avisa o período', async () => {
    trackList();
    renderWithProviders(<SaleListPage />);
    expect(await screen.findByText('Maria Oliveira')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '2000-01-01' } });

    expect(screen.getByRole('alert')).toHaveTextContent(/período/i);
    expect(screen.queryByText('Maria Oliveira')).not.toBeInTheDocument();
  });
});

