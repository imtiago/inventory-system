import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { parseMoneyToCents } from '@/shared/utils/money';

import { MoneyInput } from '../MoneyInput';
import { QuantityInput } from '../QuantityInput';

describe('parseMoneyToCents', () => {
  it.each([
    ['12,50', 1250],
    ['12.50', 1250],
    ['R$ 1.234,56', 123456],
    ['0,1', 10],
    ['7', 700],
  ])('%s -> %i', (text, cents) => expect(parseMoneyToCents(text)).toBe(cents));

  it.each(['', 'abc', '1,234', '1,2,3'])('%s -> null', (text) => expect(parseMoneyToCents(text)).toBeNull());

});

describe('MoneyInput', () => {
  it('is a decimal text field with the R$ prefix and reports cents for "12,50"', async () => {
    const onCentsChange = vi.fn();
    render(<MoneyInput aria-label="Valor" onCentsChange={onCentsChange} />);
    const input = screen.getByLabelText('Valor');

    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(screen.getByText('R$')).toBeInTheDocument();

    await userEvent.type(input, '12,50');

    expect(input).toHaveValue('12,50');
    expect(onCentsChange).toHaveBeenLastCalledWith(1250);
  });

  it('reports null for text that is not money', async () => {
    const onCentsChange = vi.fn();
    render(<MoneyInput aria-label="Valor" onCentsChange={onCentsChange} />);
    await userEvent.type(screen.getByLabelText('Valor'), 'x');
    expect(onCentsChange).toHaveBeenLastCalledWith(null);
  });
});

function Harness({ initial = '1', min, max }: { initial?: string; min?: number; max?: number }) {
  const [value, setValue] = useState(initial);
  return <QuantityInput aria-label="Quantidade" value={value} onChange={setValue} min={min} max={max} />;
}

describe('QuantityInput', () => {
  it('includes the item name in the stepper names when given', () => {
    render(<QuantityInput aria-label="Quantidade" itemName="Camiseta Azul" value="1" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Diminuir quantidade de Camiseta Azul' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aumentar quantidade de Camiseta Azul' })).toBeInTheDocument();
  });

  it('uses a numeric keypad and 44 px steppers', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Quantidade')).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByRole('button', { name: 'Diminuir quantidade' })).toHaveClass('h-11', 'w-11');
    expect(screen.getByRole('button', { name: 'Aumentar quantidade' })).toHaveClass('h-11', 'w-11');
  });

  it('increments and decrements, never below min', async () => {
    render(<Harness initial="2" min={1} />);
    const input = screen.getByLabelText('Quantidade');

    await userEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade' }));
    expect(input).toHaveValue('3');
    await userEvent.click(screen.getByRole('button', { name: 'Diminuir quantidade' }));
    await userEvent.click(screen.getByRole('button', { name: 'Diminuir quantidade' }));
    await userEvent.click(screen.getByRole('button', { name: 'Diminuir quantidade' }));
    expect(input).toHaveValue('1');
    expect(screen.getByRole('button', { name: 'Diminuir quantidade' })).toBeDisabled();
  });

  it('respects max and starts from min when empty', async () => {
    render(<Harness initial="" min={1} max={2} />);
    const input = screen.getByLabelText('Quantidade');

    await userEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade' }));
    expect(input).toHaveValue('1');
    await userEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade' }));
    expect(input).toHaveValue('2');
    expect(screen.getByRole('button', { name: 'Aumentar quantidade' })).toBeDisabled();
  });

  it('only accepts digits', async () => {
    render(<Harness initial="" />);
    await userEvent.type(screen.getByLabelText('Quantidade'), '1a2,');
    expect(screen.getByLabelText('Quantidade')).toHaveValue('12');
  });
});
