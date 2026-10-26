import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Badge, StatusBadge } from '../badge';
import { CrudBadge } from '@/shared/components/crud';

describe('Badge', () => {
  test('não quebra linha', () => {
    render(<Badge>Recebido parcialmente</Badge>);
    expect(screen.getByText('Recebido parcialmente')).toHaveClass('whitespace-nowrap');
  });

  test.each([
    ['success', 'bg-success-soft', 'text-success'],
    ['warning', 'bg-warning-soft', 'text-warning'],
    ['danger', 'bg-danger-soft', 'text-danger'],
    ['info', 'bg-info-soft', 'text-info'],
    ['neutral', 'bg-surface-muted', 'text-muted'],
  ] as const)('tom %s usa os tokens', (tone, bg, text) => {
    render(<Badge tone={tone}>x</Badge>);
    expect(screen.getByText('x')).toHaveClass(bg, text);
  });

  test('CrudBadge mantém o visual informativo e também não quebra', () => {
    render(<CrudBadge>A vencer</CrudBadge>);
    expect(screen.getByText('A vencer')).toHaveClass('whitespace-nowrap', 'bg-info-soft', 'text-info');
  });
});

describe('StatusBadge', () => {
  test('a cor vem do statusTone e o texto do rótulo', () => {
    render(
      <>
        <StatusBadge status="CANCELED">Cancelada</StatusBadge>
        <StatusBadge status="PAID">Paga</StatusBadge>
        <StatusBadge status="OVERDUE">Vencida</StatusBadge>
      </>,
    );
    expect(screen.getByText('Cancelada')).toHaveClass('text-danger');
    expect(screen.getByText('Paga')).toHaveClass('text-success');
    expect(screen.getByText('Vencida')).toHaveClass('text-danger');
  });
});
