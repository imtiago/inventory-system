import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Button } from '../button';

describe('Button', () => {
  test('primary is the default variant', () => {
    render(<Button>Salvar</Button>);
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveClass('bg-primary', 'text-primary-foreground');
  });

  test.each(['primary', 'secondary', 'outline', 'ghost', 'danger'] as const)('renders variant %s', (variant) => {
    render(<Button variant={variant}>{variant}</Button>);
    expect(screen.getByRole('button', { name: variant })).toBeInTheDocument();
  });

  test('danger and outline differ from primary', () => {
    render(
      <>
        <Button variant="danger">d</Button>
        <Button variant="outline">o</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'd' })).toHaveClass('bg-danger-solid');
    expect(screen.getByRole('button', { name: 'o' })).not.toHaveClass('bg-primary');
  });

  test('className overrides conflicting variant classes instead of being concatenated', () => {
    render(<Button className="bg-white text-gray-900">Editar</Button>);
    const button = screen.getByRole('button', { name: 'Editar' });
    expect(button).toHaveClass('bg-white', 'text-gray-900');
    expect(button).not.toHaveClass('bg-primary');
    expect(button).not.toHaveClass('text-primary-foreground');
    expect(button).toHaveClass('px-4');
  });

  test('forwards props', () => {
    render(<Button disabled>Ok</Button>);
    const button = screen.getByRole('button', { name: 'Ok' });
    expect(button).toBeDisabled();
  });
});
