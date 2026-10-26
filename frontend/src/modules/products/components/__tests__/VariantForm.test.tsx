import { describe, expect, test, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { VariantForm } from '../VariantForm';
import { renderWithProviders } from '@/test/render';
import { loginAs } from '@/test/auth';

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
    expect(await screen.findByText('O valor não pode ser negativo')).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, '1,999');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByText('Use no máximo 2 casas decimais')).toBeInTheDocument();
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

  describe('sem a permissão catalog.price (VENDEDOR)', () => {
    test('criação: o preço é obrigatório', async () => {
      loginAs('VENDEDOR');
      const onSubmit = setup();

      await userEvent.type(screen.getByPlaceholderText('Ex: Kaiak 100ml'), 'Kaiak');
      await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

      expect(await screen.findByText('Informe o preço de venda.')).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Preço de venda (R$)')).not.toHaveAttribute('readonly');
    });

    test('edição: o preço fica somente leitura com a dica e é reenviado inalterado', async () => {
      loginAs('VENDEDOR');
      const onSubmit = vi.fn();
      renderWithProviders(
        <VariantForm title="Editar" submitLabel="Salvar" requireSalePrice initialValues={{ name: 'Kaiak', salePrice: 19.9 }} onSubmit={onSubmit} onCancel={() => {}} />,
      );

      const price = screen.getByLabelText('Preço de venda (R$)');
      expect(price).toHaveAttribute('readonly');
      expect(price).toHaveValue('19,90');
      expect(screen.getByText('Somente o administrador altera o preço')).toBeInTheDocument();

      await userEvent.type(price, '5');
      await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalled());
      expect(onSubmit.mock.calls[0][0]).toMatchObject({ name: 'Kaiak', salePrice: 19.9 });
    });

    test('ADMIN edita o preço normalmente, sem dica', async () => {
      loginAs('ADMIN');
      renderWithProviders(
        <VariantForm title="Editar" submitLabel="Salvar" requireSalePrice initialValues={{ name: 'Kaiak', salePrice: 19.9 }} onSubmit={vi.fn()} onCancel={() => {}} />,
      );
      expect(screen.getByLabelText('Preço de venda (R$)')).not.toHaveAttribute('readonly');
      expect(screen.queryByText('Somente o administrador altera o preço')).not.toBeInTheDocument();
    });
  });
});
