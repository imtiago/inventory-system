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

describe('Lote: milhar e preenchimento em pt-BR', () => {
  async function fillLot(cost: string) {
    await userEvent.type(screen.getByLabelText('Lote'), 'L-1');
    await userEvent.type(screen.getByLabelText('Validade'), '2030-01-31');
    const field = screen.getByLabelText('Custo unitário');
    await userEvent.clear(field);
    await userEvent.type(field, cost);
  }

  test('"1.000" chega como 1000 (e não 1)', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<InventoryLotForm onSubmit={onSubmit} onCancel={() => {}} />);
    await fillLot('1.000');
    await userEvent.click(screen.getByRole('button', { name: /salvar|cadastrar|registrar/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ unitCost: 1000 });
  });

  test('custo preenchido aparece como "39,90" e volta como 39.9; editar o preenchido funciona', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<InventoryLotForm initialValues={{ batchNumber: 'L-1', expirationDate: '2030-01-31', unitCost: 39.9 }} onSubmit={onSubmit} onCancel={() => {}} />);

    expect(screen.getByLabelText('Custo unitário')).toHaveValue('39,90');
    await userEvent.click(screen.getByRole('button', { name: /salvar|cadastrar|registrar/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ unitCost: 39.9 });
  });

  test('"1.23,4" é inválido e não envia', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<InventoryLotForm onSubmit={onSubmit} onCancel={() => {}} />);
    await fillLot('1.23,4');
    await userEvent.click(screen.getByRole('button', { name: /salvar|cadastrar|registrar/i }));

    expect(await screen.findByText('Valor inválido')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('Variante: milhar e preenchimento em pt-BR', () => {
  test('"1.000" chega como 1000', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<VariantForm title="Nova" submitLabel="Salvar" onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByPlaceholderText('Ex: Kaiak 100ml'), 'Kaiak');
    await userEvent.type(screen.getByLabelText('Preço de venda (R$)'), '1.000');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ salePrice: 1000 });
  });

  test('preço preenchido aparece como "39,90"; sem mexer envia 39.9 e editando ",50" envia 39.5', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<VariantForm title="Editar" submitLabel="Salvar" requireSalePrice initialValues={{ name: 'Kaiak', salePrice: 39.9 }} onSubmit={onSubmit} onCancel={() => {}} />);
    const price = screen.getByLabelText('Preço de venda (R$)');
    expect(price).toHaveValue('39,90');

    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ salePrice: 39.9 });

    await userEvent.clear(price);
    await userEvent.type(price, '39,50');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit.mock.calls[1][0]).toMatchObject({ salePrice: 39.5 });
  });
});
