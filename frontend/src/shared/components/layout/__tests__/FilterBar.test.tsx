import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';

import { FilterBar, FILTER_FIELD, FILTER_GRID } from '../FilterBar';

describe('FilterBar', () => {
  test('recuo e divisória padrão em todas as listas', () => {
    render(<FilterBar>filtros</FilterBar>);
    expect(screen.getByText('filtros')).toHaveClass('border-b', 'p-4', 'sm:p-5');
  });

  test('grade com colunas mínimas de 13rem e campos de altura única (nada truncado)', () => {
    expect(FILTER_GRID).toContain('minmax(13rem,1fr)');
    expect(FILTER_FIELD).toContain('h-11');
    expect(FILTER_FIELD).toContain('w-full');
  });
});
