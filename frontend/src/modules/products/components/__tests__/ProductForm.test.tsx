import { describe, expect, test } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ProductForm } from '../ProductForm';
import { renderWithProviders } from '@/test/render';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';

function validationError(errors: { field: string; message: string }[]) {
  const config = { headers: new AxiosHeaders() };
  const response = { status: 400, data: { message: 'Dados inválidos.', code: 'VALIDATION_ERROR', errors }, statusText: '', headers: {}, config } as AxiosResponse;
  return new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, response);
}

describe('ProductForm', () => {
  test('mostra erro do backend para campo que o formulário não renderiza', async () => {
    renderWithProviders(
      <ProductForm
        title="Novo"
        description=""
        brands={[]}
        categories={[]}
        onSubmit={async () => { throw validationError([{ field: 'sku', message: 'SKU inválido.' }]); }}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /salvar|cadastrar|criar/i }));

    await waitFor(() => expect(screen.getByText('SKU inválido.')).toBeInTheDocument());
  });

  test('mostra erro inline do campo conhecido', async () => {
    renderWithProviders(
      <ProductForm
        title="Novo"
        description=""
        brands={[]}
        categories={[]}
        onSubmit={async () => { throw validationError([{ field: 'name', message: 'O nome é obrigatório.' }]); }}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /salvar|cadastrar|criar/i }));

    await waitFor(() => expect(screen.getByText('O nome é obrigatório.')).toBeInTheDocument());
  });
});
