import { describe, expect, test, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InventoryLotForm } from '../InventoryLotForm';
import { VariantForm } from '@/modules/products/components/VariantForm';
import { renderWithProviders } from '@/test/render';

describe('Lote: custo em dinheiro e quantidade com ±', () => {
  test('"12,50" vira 12.5 e o botão + soma na quantidade', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<InventoryLotForm onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.type(screen.getByLabelText('Lote'), 'L-1');
    await userEvent.type(screen.getByLabelText('Validade'), '2030-01-31');

    const cost = screen.getByLabelText('Custo unitário');
    expect(cost).toHaveAttribute('inputmode', 'decimal');
    expect(cost).toHaveAttribute('type', 'text');
    await userEvent.type(cost, '12,50');

    expect(screen.getByLabelText('Quantidade')).toHaveAttribute('inputmode', 'numeric');
    await userEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade' }));
    expect(screen.getByLabelText('Quantidade')).toHaveValue('2');

    await userEvent.click(screen.getByRole('button', { name: /salvar|cadastrar|registrar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ unitCost: 12.5, quantity: 2 });
  });
});

describe('Variante: preço em dinheiro', () => {
  test('"12,50" vira 12.5', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<VariantForm title="Nova" submitLabel="Salvar" onSubmit={onSubmit} onCancel={() => {}} />);

    await userEvent.type(screen.getByPlaceholderText('Ex: Kaiak 100ml'), 'Kaiak');
    const price = screen.getByLabelText('Preço de venda (R$)');
    expect(price).toHaveAttribute('type', 'text');
    await userEvent.type(price, '12,50');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ salePrice: 12.5 });
  });
});
