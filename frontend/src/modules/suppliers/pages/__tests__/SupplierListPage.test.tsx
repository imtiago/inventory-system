import { describe, expect, test, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { SupplierListPage } from '../SupplierListPage';
import { renderWithProviders } from '@/test/render';
import { loginAs } from '@/test/auth';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';

let posted: unknown;
let patched: unknown;

beforeEach(() => {
  posted = undefined;
  patched = undefined;
});

describe('SupplierListPage', () => {
  test('lista com documento e telefone mascarados', async () => {
    renderWithProviders(<SupplierListPage />);

    expect(await screen.findByText('Distribuidora Acme Ltda')).toBeInTheDocument();
    expect(screen.getByText('11.222.333/0001-81')).toBeInTheDocument();
    expect(screen.getByText('529.982.247-25')).toBeInTheDocument();
    expect(screen.getByText('(11) 98765-4321')).toBeInTheDocument();
  });

  test('criar envia documento só com dígitos', async () => {
    server.use(
      http.post(`${API_URL}/suppliers`, async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ data: {} }, { status: 201 });
      }),
    );
    renderWithProviders(<SupplierListPage />);
    await screen.findByText('Distribuidora Acme Ltda');

    await userEvent.click(screen.getByRole('button', { name: /Novo fornecedor/ }));
    await userEvent.type(screen.getByLabelText(/Nome/), 'Fornecedor Novo');
    await userEvent.type(screen.getByLabelText(/Documento/), '11222333000181');
    expect(screen.getByLabelText(/Documento/)).toHaveValue('11.222.333/0001-81');
    await userEvent.type(screen.getByLabelText(/Telefone/), '11987654321');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar fornecedor' }));

    await waitFor(() => expect(posted).toEqual({ name: 'Fornecedor Novo', document: '11222333000181', phone: '11987654321' }));
  });

  test('criar aceita CNPJ alfanumérico: maiúsculo, máscara e envio sem pontuação', async () => {
    server.use(
      http.post(`${API_URL}/suppliers`, async ({ request }) => {
        posted = await request.json();
        return HttpResponse.json({ data: {} }, { status: 201 });
      }),
    );
    renderWithProviders(<SupplierListPage />);
    await screen.findByText('Distribuidora Acme Ltda');

    await userEvent.click(screen.getByRole('button', { name: /Novo fornecedor/ }));
    await userEvent.type(screen.getByLabelText(/Nome/), 'Fornecedor Alfa');
    await userEvent.type(screen.getByLabelText(/Documento/), 'ab12cde3000135');
    expect(screen.getByLabelText(/Documento/)).toHaveValue('AB.12C.DE3/0001-35');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar fornecedor' }));

    await waitFor(() => expect(posted).toEqual({ name: 'Fornecedor Alfa', document: 'AB12CDE3000135' }));
  });

  test('CNPJ alfanumérico com dígitos verificadores não numéricos é recusado', async () => {
    renderWithProviders(<SupplierListPage />);
    await screen.findByText('Distribuidora Acme Ltda');

    await userEvent.click(screen.getByRole('button', { name: /Novo fornecedor/ }));
    await userEvent.type(screen.getByLabelText(/Nome/), 'Fornecedor Alfa');
    await userEvent.type(screen.getByLabelText(/Documento/), 'AB12CDE30001XY');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar fornecedor' }));

    expect(await screen.findByText(/CPF \(11 dígitos\) ou CNPJ/)).toBeInTheDocument();
  });

  test('409 de documento duplicado aparece no campo documento', async () => {
    server.use(
      http.post(`${API_URL}/suppliers`, () =>
        HttpResponse.json({ message: 'Já existe um fornecedor com esse documento.', code: 'SUPPLIER_DOCUMENT_ALREADY_EXISTS' }, { status: 409 }),
      ),
    );
    renderWithProviders(<SupplierListPage />);
    await screen.findByText('Distribuidora Acme Ltda');

    await userEvent.click(screen.getByRole('button', { name: /Novo fornecedor/ }));
    await userEvent.type(screen.getByLabelText(/Nome/), 'Fornecedor Novo');
    await userEvent.type(screen.getByLabelText(/Documento/), '11222333000181');
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar fornecedor' }));

    expect(await screen.findAllByText('Já existe um fornecedor com esse documento.')).toHaveLength(1);
    expect(screen.getByLabelText(/Documento/)).toHaveAttribute('aria-invalid', 'true');
  });

  test('editar envia só o que mudou', async () => {
    server.use(
      http.patch(`${API_URL}/suppliers/:id`, async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json({ data: {} });
      }),
    );
    renderWithProviders(<SupplierListPage />);
    await screen.findByText('Distribuidora Acme Ltda');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Distribuidora Acme Ltda' }));
    const name = screen.getByLabelText(/Nome/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Acme Renomeada');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(patched).toEqual({ name: 'Acme Renomeada' }));
  });

  test('excluir pede confirmação; 409 SUPPLIER_IN_USE aparece uma vez', async () => {
    let deletes = 0;
    server.use(
      http.delete(`${API_URL}/suppliers/:id`, () => {
        deletes += 1;
        return HttpResponse.json({ message: 'Fornecedor com pedidos não pode ser excluído.', code: 'SUPPLIER_IN_USE' }, { status: 409 });
      }),
    );
    renderWithProviders(<SupplierListPage />);
    await screen.findByText('Distribuidora Acme Ltda');

    await userEvent.click(screen.getByRole('button', { name: 'Excluir Distribuidora Acme Ltda' }));
    expect(deletes).toBe(0);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }));

    expect(await screen.findAllByText('Fornecedor com pedidos não pode ser excluído.')).toHaveLength(1);
    expect(deletes).toBe(1);
  });

  test('ESTOQUISTA não vê criar/editar/excluir', async () => {
    loginAs('ESTOQUISTA');
    renderWithProviders(<SupplierListPage />);
    await screen.findByText('Distribuidora Acme Ltda');

    expect(screen.queryByRole('button', { name: /Novo fornecedor/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Excluir/ })).not.toBeInTheDocument();
  });
});
