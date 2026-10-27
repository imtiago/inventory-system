import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { formatBps, parsePercentToBps, percentTextError } from '@/shared/utils/percent';

import { PercentInput } from '../PercentInput';

describe('parsePercentToBps', () => {
  it.each([
    ['3,99', 399],
    ['3.99', 399],
    ['30', 3000],
    ['0,5', 50],
    ['7,50%', 750],
    [' 12 % ', 1200],
  ])('%s -> %i', (text, bps) => expect(parsePercentToBps(text)).toEqual({ kind: 'ok', bps }));

  it('reports empty, invalid and too many decimals', () => {
    expect(parsePercentToBps('')).toEqual({ kind: 'empty' });
    expect(parsePercentToBps('abc')).toEqual({ kind: 'invalid' });
    expect(parsePercentToBps('-1')).toEqual({ kind: 'invalid' });
    expect(parsePercentToBps('1,2,3')).toEqual({ kind: 'invalid' });
    expect(parsePercentToBps('3,999')).toEqual({ kind: 'decimals' });
  });
});

describe('percentTextError', () => {
  it('rejects more than 2 decimals and 100% or more', () => {
    expect(percentTextError('3,999')).toBe('Use no máximo 2 casas decimais');
    expect(percentTextError('100')).toBe('O percentual deve ser menor que 100%');
    expect(percentTextError('99,99')).toBeNull();
    expect(percentTextError('')).toBe('Informe um percentual');
    expect(percentTextError('', { allowEmpty: true })).toBeNull();
  });
});

describe('formatBps', () => {
  it('formats basis points as pt-BR percent', () => {
    expect(formatBps(399)).toBe('3,99%');
    expect(formatBps(3000)).toBe('30,00%');
  });
});

describe('PercentInput', () => {
  it('is a decimal text field with the % suffix and reports bps', async () => {
    const onBpsChange = vi.fn();
    render(<PercentInput aria-label="Margem" onBpsChange={onBpsChange} />);
    const input = screen.getByLabelText('Margem');

    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(screen.getByText('%')).toBeInTheDocument();

    await userEvent.type(input, '3,99');
    expect(onBpsChange).toHaveBeenLastCalledWith(399);

    await userEvent.clear(input);
    await userEvent.type(input, '3,999');
    expect(onBpsChange).toHaveBeenLastCalledWith(null);
  });
});
