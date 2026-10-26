import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { VariantStock } from '../VariantStock';

describe('VariantStock', () => {
  test('mostra disponível', () => {
    render(<VariantStock balance={{ productVariantId: 'v', quantity: 42, reserved: 2, available: 40, expired: 0 }} loading={false} error={false} />);
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('Disp.')).toBeInTheDocument();
  });

  test("sem saldo (variante sem inventário) mostra 'Sem estoque'", () => {
    render(<VariantStock loading={false} error={false} />);
    expect(screen.getByText('Sem estoque')).toBeInTheDocument();
  });

  test('carregando mostra indicador acessível', () => {
    render(<VariantStock loading error={false} />);
    expect(screen.getByRole('status', { name: 'Carregando estoque' })).toBeInTheDocument();
    expect(screen.queryByText('Sem estoque')).not.toBeInTheDocument();
  });

  test("erro mostra 'Erro ao carregar estoque', não 'Sem estoque'", () => {
    render(<VariantStock loading={false} error />);
    expect(screen.getByText('Erro ao carregar estoque')).toBeInTheDocument();
    expect(screen.queryByText('Sem estoque')).not.toBeInTheDocument();
  });

  test('mostra "Vencido: n" quando há saldo vencido', () => {
    render(<VariantStock balance={{ productVariantId: 'v', quantity: 42, reserved: 2, available: 40, expired: 6 }} loading={false} error={false} />);
    expect(screen.getByText('Vencido: 6')).toBeInTheDocument();
  });
});
