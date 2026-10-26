import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SalesChart } from '../SalesChart';

const days = [
  { date: '2026-10-20', count: 1, total: 100 },
  { date: '2026-10-21', count: 3, total: 250.5 },
];

describe('SalesChart no toque (B4)', () => {
  test('tocar numa barra mostra o dia, o valor e as vendas', async () => {
    render(<SalesChart days={days} />);
    expect(screen.queryByTestId('sales-readout')).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByTestId('sales-bar')[1]);

    const readout = screen.getByTestId('sales-readout');
    expect(readout).toHaveTextContent('21/10');
    expect(readout).toHaveTextContent('250,50');
    expect(readout).toHaveTextContent('3 vendas');
  });

  test('tocar de novo na mesma barra esconde o valor', async () => {
    render(<SalesChart days={days} />);
    const bar = screen.getAllByTestId('sales-bar')[0];
    await userEvent.click(bar);
    await userEvent.click(bar);
    expect(screen.queryByTestId('sales-readout')).not.toBeInTheDocument();
  });
});
