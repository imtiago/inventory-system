import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { DataTable } from '../DataTable';
import { DetailTable } from '../../details/DetailTable';

interface Row {
  id: string;
  name: string;
  total: string;
}

const rows: Row[] = [{ id: '1', name: 'Camiseta', total: 'R$ 1.234,56' }];

describe('DataTable: números à direita', () => {
  test('coluna numeric fica à direita, tabular e sem quebra (cabeçalho e célula)', () => {
    render(
      <MemoryRouter>
        <DataTable
          data={rows}
          columns={[
            { id: 'name', header: 'Produto', cell: (r) => r.name },
            { id: 'total', header: 'Total', numeric: true, cell: (r) => r.total },
          ]}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('columnheader', { name: 'Total' })).toHaveClass('text-right');
    expect(screen.getByRole('cell', { name: 'R$ 1.234,56' })).toHaveClass('text-right', 'tabular-nums', 'whitespace-nowrap');
    expect(screen.getByRole('cell', { name: 'Camiseta' })).toHaveClass('text-left');
  });

  test('células e cabeçalho usam tokens de tema', () => {
    render(
      <MemoryRouter>
        <DataTable data={rows} columns={[{ id: 'name', header: 'Produto', cell: (r) => r.name }]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('columnheader', { name: 'Produto' })).toHaveClass('text-muted');
    expect(screen.getByRole('cell', { name: 'Camiseta' })).toHaveClass('text-foreground');
  });
});

describe('DetailTable', () => {
  test('cabeçalho e células têm espaçamento lateral', () => {
    render(
      <DetailTable
        rows={rows}
        getRowId={(r) => r.id}
        columns={[
          { id: 'total', header: 'Valor', align: 'right', cell: (r) => r.total },
          { id: 'name', header: 'Status', cell: (r) => r.name },
        ]}
      />,
    );
    const header = screen.getByRole('columnheader', { name: 'Valor' });
    const cell = screen.getByRole('cell', { name: 'R$ 1.234,56' });
    expect(header).toHaveClass('px-3');
    expect(cell).toHaveClass('px-3', 'text-right', 'tabular-nums');
    expect(screen.getByRole('cell', { name: 'Camiseta' })).toHaveClass('px-3', 'text-foreground');
  });
});

describe('DataTable: cabeçalho fixo na rolagem da página', () => {
  test('thead é sticky e o recipiente não vira contêiner de rolagem vertical no desktop', () => {
    render(
      <MemoryRouter>
        <DataTable data={rows} columns={[{ id: 'name', header: 'Produto', cell: (r) => r.name }]} />
      </MemoryRouter>,
    );
    const table = screen.getByRole('table');
    expect(table.querySelector('thead')).toHaveClass('sticky', 'top-0');
    // overflow-x-clip (lg+) não cria contêiner de rolagem, então o sticky acompanha a rolagem da página.
    expect(table.parentElement).toHaveClass('lg:overflow-x-clip');
  });
});
