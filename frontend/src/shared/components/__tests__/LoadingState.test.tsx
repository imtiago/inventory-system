import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';

import { LoadingState } from '../LoadingState';

describe('LoadingState', () => {
  test('é um status anunciado com o texto e o indicador girando', () => {
    render(<LoadingState label="Carregando vendas..." />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Carregando vendas...');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status.querySelector('svg.animate-spin')).not.toBeNull();
  });

  test('o padrão ocupa a área toda; compact é para blocos pequenos dentro da tela', () => {
    const { rerender } = render(<LoadingState label="A" />);
    expect(screen.getByRole('status').className).toContain('min-h-48');
    rerender(<LoadingState label="A" compact />);
    expect(screen.getByRole('status').className).not.toContain('min-h-48');
  });
});
