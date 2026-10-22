import { describe, expect, test } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { CustomerForm } from '../CustomerForm';
import { useCreateCustomer } from '../../hooks/useCreateCustomer';
import { renderWithProviders } from '@/test/render';
import { server } from '@/test/server';
import { API_URL } from '@/test/handlers/inventory';

function Harness() {
  const { mutateAsync } = useCreateCustomer();

  return <CustomerForm onCancel={() => {}} onSubmit={async (data) => { await mutateAsync(data); }} />;
}

describe('CustomerForm', () => {
  test('mostra erro do backend no campo email', async () => {
    server.use(
      http.post(`${API_URL}/customers`, () =>
        HttpResponse.json(
          { message: 'Dados inválidos.', code: 'VALIDATION_ERROR', errors: [{ field: 'email', message: 'E-mail inválido.' }] },
          { status: 400 },
        ),
      ),
    );

    renderWithProviders(<Harness />);

    await userEvent.type(screen.getByLabelText(/nome completo/i), 'Maria');
    await userEvent.click(screen.getByRole('button', { name: /cadastrar cliente/i }));

    await waitFor(() => expect(screen.getByText('E-mail inválido.')).toBeInTheDocument());
  });
});
