import { describe, expect, test } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';

import { Sidebar } from '../Sidebar';
import { createTestQueryClient } from '@/test/render';
import { loginAs } from '@/test/auth';
import { useAuthStore } from '@/shared/store/auth';
import type { UserRole } from '@/shared/auth/permissions';

function renderSidebar(role: UserRole, client = createTestQueryClient()) {
  loginAs(role);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

const labels = ['Dashboard', 'Vendas', 'Clientes', 'Estoque', 'Catálogo', 'Produtos', 'Marcas', 'Categorias', 'Compras', 'Fornecedores', 'Pedidos de compra', 'Financeiro', 'Contas a receber', 'Contas a pagar'];

function visible() {
  return labels.filter((l) => screen.queryByText(l));
}

describe('Sidebar', () => {
  test('ADMIN vê tudo', () => {
    renderSidebar('ADMIN');
    expect(visible()).toEqual(labels);
    expect(screen.getByText('Usuários')).toBeInTheDocument();
  });

  test('todo usuário logado vê "Alterar senha" no menu do usuário', async () => {
    renderSidebar('ESTOQUISTA');
    expect(screen.getByRole('button', { name: /Alterar senha/ })).toBeInTheDocument();
  });

  test('VENDEDOR vê tudo exceto Usuários, Compras e Contas a pagar', () => {
    renderSidebar('VENDEDOR');
    expect(visible()).toEqual(labels.filter((l) => !['Compras', 'Fornecedores', 'Pedidos de compra', 'Contas a pagar'].includes(l)));
    expect(screen.queryByText('Usuários')).not.toBeInTheDocument();
    expect(screen.getByText('Contas a receber')).toBeInTheDocument();
  });

  test('VENDEDOR não vê Compras', () => {
    renderSidebar('VENDEDOR');
    expect(screen.queryByText('Compras')).not.toBeInTheDocument();
    expect(screen.queryByText('Fornecedores')).not.toBeInTheDocument();
    expect(screen.queryByText('Pedidos de compra')).not.toBeInTheDocument();
  });

  test('ESTOQUISTA não vê Contas a pagar', () => {
    renderSidebar('ESTOQUISTA');
    expect(screen.queryByText('Contas a pagar')).not.toBeInTheDocument();
  });

  test('ESTOQUISTA vê Compras, sem Vendas/Clientes/Financeiro', () => {
    renderSidebar('ESTOQUISTA');
    expect(visible()).toEqual(['Dashboard', 'Estoque', 'Catálogo', 'Produtos', 'Marcas', 'Categorias', 'Compras', 'Fornecedores', 'Pedidos de compra']);
  });

  test('logout limpa o cache e a sessão: próximo usuário não vê dados do anterior', async () => {
    const client = renderSidebar('ADMIN');
    client.setQueryData(['sales'], { secret: 'dados do admin' });

    await userEvent.click(screen.getByRole('button', { name: /Sair/ }));

    expect(client.getQueryData(['sales'])).toBeUndefined();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });
});
