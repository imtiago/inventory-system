import { describe, expect, test } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';

import { CustomerForm } from '../CustomerForm';
import { useCreateCustomer } from '../../hooks/useCreateCustomer';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';

function Harness() {
  const { mutateAsync } = useCreateCustomer();

  return <CustomerForm onCancel={() => {}} onSubmit={async (data) => { await mutateAsync(data); }} />;
}

function failWith(errors: { field: string; message: string }[]) {
  server.use(
    http.post(`${API_URL}/customers`, () =>
      HttpResponse.json({ message: 'Dados inválidos.', code: 'VALIDATION_ERROR', errors }, { status: 400 }),
    ),
  );
}

async function submitValid() {
  await userEvent.type(screen.getByLabelText(/nome completo/i), 'Maria');
  await userEvent.click(screen.getByRole('button', { name: /cadastrar cliente/i }));
}

describe('CustomerForm', () => {
  test.each([
    ['name', /nome completo/i, 'O nome é inválido.'],
    ['email', /e-mail/i, 'E-mail inválido.'],
    ['phone', /telefone/i, 'Telefone inválido.'],
    ['address', /endereço/i, 'Endereço inválido.'],
  ])('mostra erro do backend no campo %s, ligado ao campo por aria', async (field, label, message) => {
    failWith([{ field, message }]);
    renderWithProviders(<Harness />);

    await submitValid();

    const error = await screen.findByText(message);
    const input = screen.getByLabelText(label);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);
    expect(error.id).not.toBe('');
  });

  test('erro de campo sem campo visível cai no alerta geral', async () => {
    failWith([{ field: 'document', message: 'Documento inválido.' }]);
    renderWithProviders(<Harness />);

    await submitValid();

    expect(await screen.findByRole('alert')).toHaveTextContent('Documento inválido.');
  });

  test('dois cliques em cadastrar enviam uma única requisição', async () => {
    let posts = 0;
    server.use(
      http.post(`${API_URL}/customers`, async () => {
        posts += 1;
        await delay(100);
        return HttpResponse.json({ data: { id: 'c-1' } }, { status: 201 });
      }),
    );
    renderWithProviders(<Harness />);

    await userEvent.type(screen.getByLabelText(/nome completo/i), 'Maria');
    const button = screen.getByRole('button', { name: /cadastrar cliente/i });
    await userEvent.dblClick(button);

    await waitFor(() => expect(screen.getByRole('button', { name: /cadastrando/i })).toBeDisabled());
    await waitFor(() => expect(screen.getByRole('button', { name: /cadastrar cliente/i })).toBeEnabled());
    expect(posts).toBe(1);
  });
});
