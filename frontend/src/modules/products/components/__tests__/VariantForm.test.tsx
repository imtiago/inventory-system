import { describe, expect, test, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VariantForm } from '../VariantForm';
import { renderWithProviders } from '@/test/render';

function setup(onSubmit = vi.fn()) {
  renderWithProviders(<VariantForm title="Nova" submitLabel="Salvar" onSubmit={onSubmit} onCancel={() => {}} />);
  return onSubmit;
}

describe('VariantForm', () => {
  test('envia salePrice como número', async () => {
    const onSubmit = setup();

    await userEvent.type(screen.getByPlaceholderText('Ex: Kaiak 100ml'), 'Kaiak 100ml');
    await userEvent.type(screen.getByLabelText('Preço de venda (R$)'), '39.9');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ name: 'Kaiak 100ml', salePrice: 39.9 });
  });

  test('rejeita preço negativo e mais de 2 casas decimais', async () => {
    const onSubmit = setup();
    const input = screen.getByLabelText('Preço de venda (R$)');

    await userEvent.type(input, '-1');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('O preço não pode ser negativo.')).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, '1.999');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('O preço deve ter no máximo 2 casas decimais.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('dois cliques em salvar chamam onSubmit uma única vez', async () => {
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 100)));
    setup(onSubmit);

    await userEvent.type(screen.getByPlaceholderText('Ex: Kaiak 100ml'), 'Kaiak');
    await userEvent.dblClick(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.getByRole('button', { name: /salvando/i })).toBeDisabled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salvar' })).toBeEnabled());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
