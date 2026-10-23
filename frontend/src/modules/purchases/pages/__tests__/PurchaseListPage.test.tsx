import { describe, expect, test } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { PurchaseListPage } from '../PurchaseListPage';
import { renderWithProviders } from '@/test/render';
import { loginAs } from '@/test/auth';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import purchaseList from '@/test/fixtures/purchases/purchaseList.json';


describe('PurchaseListPage', () => {
  test('lista com código (link), fornecedor, total, progresso e status', async () => {
    renderWithProviders(<PurchaseListPage />);

    const link = await screen.findByRole('link', { name: 'PC000012' });
    expect(link).toHaveAttribute('href', '/purchases/5f2c8e1a-3b7d-4c9e-8a1f-6d4b2e9c7a10');
    expect(screen.getByText('Distribuidora Têxtil Ltda')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText('Recebido parcialmente', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Novo pedido/ })).toBeInTheDocument();
  });

  test('filtros de status e código vão para a API', async () => {
    const urls: URL[] = [];
    server.use(
      http.get(`${API_URL}/purchases`, ({ request }) => {
        urls.push(new URL(request.url));
        return HttpResponse.json(purchaseList);
      }),
    );
    renderWithProviders(<PurchaseListPage />);
    await screen.findByRole('link', { name: 'PC000012' });

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'PENDING');
    await userEvent.type(screen.getByLabelText('Buscar por código'), 'PC0000');

    await waitFor(() => {
      const last = urls[urls.length - 1];
      expect(last.searchParams.get('status')).toBe('PENDING');
      expect(last.searchParams.get('search')).toBe('PC0000');
    });
  });

  test('filtros de fornecedor e período vão para a API', async () => {
    const urls: URL[] = [];
    server.use(
      http.get(`${API_URL}/purchases`, ({ request }) => {
        urls.push(new URL(request.url));
        return HttpResponse.json(purchaseList);
      }),
    );
    renderWithProviders(<PurchaseListPage />);
    await screen.findByRole('link', { name: 'PC000012' });

    await userEvent.type(screen.getByPlaceholderText('Todos os fornecedores'), 'Acm');
    await userEvent.click(await screen.findByText('Distribuidora Acme Ltda'));
    await userEvent.type(screen.getByLabelText('Data de'), '2026-10-01');
    await userEvent.type(screen.getByLabelText('Data até'), '2026-10-31');

    await waitFor(() => {
      const last = urls[urls.length - 1];
      expect(last.searchParams.get('supplierId')).toBe('b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e');
      expect(last.searchParams.get('from')).toBe('2026-10-01');
      expect(last.searchParams.get('to')).toBe('2026-10-31');
    });
  });

  test('ESTOQUISTA vê a lista mas não "Novo pedido"', async () => {
    loginAs('ESTOQUISTA');
    renderWithProviders(<PurchaseListPage />);
    await screen.findByRole('link', { name: 'PC000012' });

    expect(screen.queryByRole('link', { name: /Novo pedido/ })).not.toBeInTheDocument();
  });
});
