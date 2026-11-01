import { describe, expect, test, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CrediarioSimulationTable } from '../CrediarioSimulationTable';
import { setViewport } from '@/test/viewport';
import saleSimulation from '@/test/fixtures/sales/saleSimulation.json';
import type { ISaleSimulationCrediario } from '../../../types';

const base = saleSimulation.data.crediario as ISaleSimulationCrediario;

const withOptions = (patch: Partial<ISaleSimulationCrediario> = {}): ISaleSimulationCrediario => ({
  ...base,
  maxInstallments: 3,
  options: [
    ...base.options,
    { installments: 3, downPayment: 47.91, installmentAmount: 40.24, lastInstallmentAmount: 40.25, total: 168.64, surcharge: 8.94, surchargePercent: 8, margin: null },
  ],
  ...patch,
});

describe('CrediarioSimulationTable', () => {
  test('lista todas as opções com entrada, parcela, total a prazo e acréscimo em R$ e %', () => {
    render(<CrediarioSimulationTable crediario={withOptions()} selected={null} onSelect={() => {}} showMargin={false} />);

    const table = screen.getByRole('table', { name: 'Opções do crediário' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);

    const third = rows[2];
    expect(within(third).getByText('3x')).toBeInTheDocument();
    expect(within(third).getByText(/47,91/)).toBeInTheDocument();
    expect(within(third).getByText(/40,24/)).toBeInTheDocument();
    expect(within(third).getByText(/168,64/)).toBeInTheDocument();
    expect(within(third).getByText(/8,94/)).toBeInTheDocument();
    expect(within(third).getByText(/8,00%/)).toBeInTheDocument();
    // Última parcela diferente aparece.
    expect(within(third).getByText(/última R\$\s40,25/)).toBeInTheDocument();
    expect(within(rows[0]).getByText('Sem acréscimo')).toBeInTheDocument();
  });

  test('margem só quando showMargin; margem sem custo vira "—"', () => {
    const { rerender } = render(<CrediarioSimulationTable crediario={withOptions()} selected={null} onSelect={() => {}} showMargin={false} />);
    expect(screen.queryByRole('columnheader', { name: 'Margem' })).not.toBeInTheDocument();

    rerender(<CrediarioSimulationTable crediario={withOptions()} selected={null} onSelect={() => {}} showMargin />);
    const table = screen.getByRole('table', { name: 'Opções do crediário' });
    expect(within(table).getByRole('columnheader', { name: 'Margem' })).toBeInTheDocument();
    const rows = within(table).getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText(/62,40/)).toBeInTheDocument();
    expect(within(rows[2]).getByTestId('option-margin')).toHaveTextContent('—');
  });

  test('escolher uma opção chama onSelect com o número de parcelas', async () => {
    const onSelect = vi.fn();
    render(<CrediarioSimulationTable crediario={withOptions()} selected={1} onSelect={onSelect} showMargin={false} />);
    expect(screen.getByRole('radio', { name: /1x de/ })).toBeChecked();

    await userEvent.click(screen.getByRole('radio', { name: /2x de R\$\s55,90/ }));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  test('opção acima do disponível fica esmaecida com o motivo, mas pode ser escolhida (pede autorização)', () => {
    // financiado 111,79; 3x soma 120,73 > 115
    render(<CrediarioSimulationTable crediario={withOptions({ available: 115 })} selected={null} onSelect={() => {}} showMargin={false} />);
    const rows = within(screen.getByRole('table', { name: 'Opções do crediário' })).getAllByRole('row').slice(1);
    expect(within(rows[0]).queryByText('Acima do disponível')).not.toBeInTheDocument();
    expect(within(rows[2]).getByText('Acima do disponível')).toBeInTheDocument();
    expect(rows[2]).toHaveAttribute('data-blocked', 'true');
    expect(within(rows[2]).getByRole('radio')).toBeEnabled();
  });

  test('crediário desligado ou ficha suspensa: todas indisponíveis, com o motivo', () => {
    render(<CrediarioSimulationTable crediario={withOptions({ allowed: false, blockedReason: 'SUSPENDED' })} selected={null} onSelect={() => {}} showMargin={false} />);
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
    expect(screen.getAllByText('Crédito suspenso')).toHaveLength(3);
  });

  test('no celular vira cartões (radiogroup), sem tabela', () => {
    setViewport(375);
    render(<CrediarioSimulationTable crediario={withOptions()} selected={null} onSelect={() => {}} showMargin />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const group = screen.getByRole('radiogroup', { name: 'Opções do crediário' });
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
    expect(within(group).getAllByText(/Margem/).length).toBeGreaterThan(0);
  });

  test('sem opções (entrada cobre o total) mostra aviso', () => {
    render(<CrediarioSimulationTable crediario={withOptions({ options: [], maxInstallments: 0, allowed: false })} selected={null} onSelect={() => {}} showMargin={false} />);
    expect(screen.getByText('Nada a financiar: a entrada cobre o total.')).toBeInTheDocument();
  });
});
