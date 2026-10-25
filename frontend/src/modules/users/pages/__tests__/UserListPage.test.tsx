import { describe, expect, test } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { UserListPage } from '../UserListPage';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';
import userList from '@/test/fixtures/users/userList.json';

const [maria, joao] = userList.data;

async function openList() {
  renderWithProviders(<UserListPage />);
  expect(await screen.findByText('Maria Estoque')).toBeInTheDocument();
}

function row(name: string) {
  return screen.getByText(name).closest('tr') as HTMLElement;
}

describe('UserListPage', () => {
  test('lista usuários com papel e status em PT, busca e cria enviando { name, email, password, role }', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API_URL}/users`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        return HttpResponse.json({ data: { ...maria, id: 'new', ...body, password: undefined, active: true } }, { status: 201 });
      }),
    );
    await openList();

    expect(within(row('Maria Estoque')).getByText('Estoquista')).toBeInTheDocument();
    expect(within(row('Maria Estoque')).getByText('Ativo')).toBeInTheDocument();
    expect(within(row('João Vendas')).getByText('Vendedor')).toBeInTheDocument();
    expect(within(row('João Vendas')).getByText('Inativo')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Buscar usuários'), 'joao');
    await waitFor(() => expect(screen.queryByText('Maria Estoque')).not.toBeInTheDocument());
    expect(screen.getByText('João Vendas')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Buscar usuários'));
    expect(await screen.findByText('Maria Estoque')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Novo usuário/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Nome/), 'Ana Nova');
    await userEvent.type(within(dialog).getByLabelText(/E-mail/), 'ana@example.com');
    await userEvent.type(within(dialog).getByLabelText(/Senha/), 'SenhaForte123');
    await userEvent.selectOptions(within(dialog).getByLabelText(/Papel/), 'VENDEDOR');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar usuário' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies).toEqual([{ name: 'Ana Nova', email: 'ana@example.com', password: 'SenhaForte123', role: 'VENDEDOR' }]);
  });

  test('clique duplo em "Criar usuário" envia uma única criação', async () => {
    let posts = 0;
    server.use(
      http.post(`${API_URL}/users`, async ({ request }) => {
        posts += 1;
        const body = (await request.json()) as Record<string, unknown>;
        await new Promise((r) => setTimeout(r, 100));
        return HttpResponse.json({ data: { ...maria, id: 'new', ...body, active: true } }, { status: 201 });
      }),
    );
    await openList();
    await userEvent.click(screen.getByRole('button', { name: /Novo usuário/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Nome/), 'Ana Nova');
    await userEvent.type(within(dialog).getByLabelText(/E-mail/), 'ana@example.com');
    await userEvent.type(within(dialog).getByLabelText(/Senha/), 'SenhaForte123');
    await userEvent.selectOptions(within(dialog).getByLabelText(/Papel/), 'VENDEDOR');
    await userEvent.dblClick(within(dialog).getByRole('button', { name: 'Criar usuário' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(posts).toBe(1);
  });

  test('criar: e-mail duplicado mostra erro no campo e mantém o modal', async () => {
    server.use(
      http.post(`${API_URL}/users`, () =>
        HttpResponse.json({ message: 'E-mail já está em uso.', code: 'EMAIL_ALREADY_IN_USE' }, { status: 409 }),
      ),
    );
    await openList();
    await userEvent.click(screen.getByRole('button', { name: /Novo usuário/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Nome/), 'Ana');
    await userEvent.type(within(dialog).getByLabelText(/E-mail/), 'maria@example.com');
    await userEvent.type(within(dialog).getByLabelText(/Senha/), 'SenhaForte123');
    await userEvent.selectOptions(within(dialog).getByLabelText(/Papel/), 'ADMIN');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar usuário' }));

    expect(await within(dialog).findByText('E-mail já está em uso.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('criar: erros de validação do backend aparecem nos campos', async () => {
    server.use(
      http.post(`${API_URL}/users`, () =>
        HttpResponse.json(
          { message: 'Dados inválidos.', code: 'VALIDATION_ERROR', errors: [{ field: 'password', message: 'Senha fraca demais.' }] },
          { status: 400 },
        ),
      ),
    );
    await openList();
    await userEvent.click(screen.getByRole('button', { name: /Novo usuário/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/Nome/), 'Ana');
    await userEvent.type(within(dialog).getByLabelText(/E-mail/), 'ana@example.com');
    await userEvent.type(within(dialog).getByLabelText(/Senha/), 'SenhaForte123');
    await userEvent.selectOptions(within(dialog).getByLabelText(/Papel/), 'ADMIN');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Criar usuário' }));

    expect(await within(dialog).findByText('Senha fraca demais.')).toBeInTheDocument();
  });

  test('editar muda papel e ativo enviando PATCH; e-mail não é editável', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.patch(`${API_URL}/users/${joao.id}`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: { ...joao, role: 'ESTOQUISTA', active: true } });
      }),
    );
    await openList();

    await userEvent.click(screen.getByRole('button', { name: 'Editar João Vendas' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('joao@example.com')).toBeInTheDocument();
    expect(within(dialog).queryByRole('textbox', { name: /E-mail/ })).not.toBeInTheDocument();

    await userEvent.selectOptions(within(dialog).getByLabelText(/Papel/), 'ESTOQUISTA');
    await userEvent.click(within(dialog).getByLabelText('Usuário ativo'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies).toEqual([{ name: 'João Vendas', role: 'ESTOQUISTA', active: true }]);
  });

  test.each([
    ['LAST_ADMIN', 'Não é possível remover o último administrador.'],
    ['CANNOT_CHANGE_OWN_ACCESS', 'Você não pode alterar o próprio acesso.'],
  ])('editar: 409 %s mostra a mensagem do backend', async (code, message) => {
    server.use(http.patch(`${API_URL}/users/${maria.id}`, () => HttpResponse.json({ message, code }, { status: 409 })));
    await openList();

    await userEvent.click(screen.getByRole('button', { name: 'Editar Maria Estoque' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText('Usuário ativo'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    expect(await within(dialog).findByText(message)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('na própria linha, papel e ativo ficam desabilitados e só o nome é enviado', async () => {
    const bodies: unknown[] = [];
    const self = { ...maria, id: 'user-ADMIN', name: 'Eu Mesmo', email: 'eu@example.com', role: 'ADMIN' };
    server.use(
      http.get(`${API_URL}/users`, () => HttpResponse.json({ data: [self], pagination: userList.pagination })),
      http.patch(`${API_URL}/users/user-ADMIN`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ data: self });
      }),
    );
    renderWithProviders(<UserListPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Eu Mesmo' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByLabelText(/Papel/)).toBeDisabled();
    expect(within(dialog).getByLabelText('Usuário ativo')).toBeDisabled();
    expect(within(dialog).getByText(/próprio acesso/i)).toBeInTheDocument();

    await userEvent.clear(within(dialog).getByLabelText(/Nome/));
    await userEvent.type(within(dialog).getByLabelText(/Nome/), 'Eu Renomeado');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(bodies).toEqual([{ name: 'Eu Renomeado' }]));
  });

  test('redefinir senha envia POST /users/:id/password; exige confirmação igual', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API_URL}/users/${joao.id}/password`, async ({ request }) => {
        bodies.push(await request.json());
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await openList();

    await userEvent.click(screen.getByRole('button', { name: 'Redefinir senha de João Vendas' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Nova senha'), 'NovaSenha123');
    await userEvent.type(within(dialog).getByLabelText('Confirmar nova senha'), 'Diferente123');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Redefinir senha' }));

    expect(await within(dialog).findByText('As senhas não coincidem.')).toBeInTheDocument();
    expect(bodies).toEqual([]);

    await userEvent.clear(within(dialog).getByLabelText('Confirmar nova senha'));
    await userEvent.type(within(dialog).getByLabelText('Confirmar nova senha'), 'NovaSenha123');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Redefinir senha' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(bodies).toEqual([{ password: 'NovaSenha123' }]);
  });
});
