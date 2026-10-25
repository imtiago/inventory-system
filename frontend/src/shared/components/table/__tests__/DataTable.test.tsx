import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { setViewport } from '@/test/viewport';

import { DataTable } from '../DataTable';
import type { DataTableColumn } from '../types';

interface Row {
  id: string;
  name: string;
  code: string;
  secret: string;
  price: string;
}

const rows: Row[] = [
  { id: '1', name: 'Camiseta', code: 'C-1', secret: 'oculto-1', price: 'R$ 10,00' },
  { id: '2', name: 'Calça', code: 'C-2', secret: 'oculto-2', price: 'R$ 20,00' },
];

function makeColumns(onDelete = vi.fn()): DataTableColumn<Row>[] {
  return [
    { id: 'name', header: 'Produto', mobile: 'title', cell: (r) => r.name },
    { id: 'code', header: 'Código', mobile: 'subtitle', cell: (r) => r.code },
    { id: 'price', header: 'Preço', mobile: 'meta', cell: (r) => r.price },
    { id: 'secret', header: 'Segredo', mobile: 'hidden', cell: (r) => r.secret },
    {
      id: 'actions',
      header: 'Ações',
      mobile: 'actions',
      cell: (r) => (
        <button type="button" onClick={() => onDelete(r)}>
          Excluir {r.name}
        </button>
      ),
    },
  ];
}

function renderTable(columns = makeColumns(), getRowHref?: (row: Row) => string) {
  return render(
    <MemoryRouter initialEntries={['/list']}>
      <Routes>
        <Route path="/list" element={<DataTable data={rows} columns={columns} getRowId={(r) => r.id} getRowHref={getRowHref} />} />
        <Route path="/items/:id" element={<p>Detalhe aberto</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DataTable', () => {
  it('renders a table on desktop', () => {
    renderTable();

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('oculto-1')).toBeInTheDocument();
  });

  describe('below md', () => {
    it('renders cards with title, subtitle and labelled meta, omitting hidden columns', () => {
      setViewport(375);
      renderTable();

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      const cards = screen.getAllByRole('listitem');
      expect(cards).toHaveLength(2);
      expect(within(cards[0]).getByText('Camiseta')).toBeInTheDocument();
      expect(within(cards[0]).getByText('C-1')).toBeInTheDocument();
      expect(within(cards[0]).getByText('Preço')).toBeInTheDocument();
      expect(within(cards[0]).getByText('R$ 10,00')).toBeInTheDocument();
      expect(screen.queryByText('oculto-1')).not.toBeInTheDocument();
    });

    it('opens the row link when the card is clicked', async () => {
      setViewport(375);
      renderTable(makeColumns(), (r) => `/items/${r.id}`);

      await userEvent.click(screen.getByText('Camiseta'));

      expect(screen.getByText('Detalhe aberto')).toBeInTheDocument();
    });

    it('does not navigate when nothing links the row', async () => {
      setViewport(375);
      renderTable();

      await userEvent.click(screen.getByText('Camiseta'));

      expect(screen.queryByText('Detalhe aberto')).not.toBeInTheDocument();
    });

    it('puts the actions in a 44px "⋯" menu that runs the same handler without opening the card', async () => {
      setViewport(375);
      const onDelete = vi.fn();
      renderTable(makeColumns(onDelete), (r) => `/items/${r.id}`);

      expect(screen.queryByRole('button', { name: 'Excluir Camiseta' })).not.toBeInTheDocument();

      const trigger = screen.getByRole('button', { name: 'Mais ações Camiseta' });
      expect(trigger.className).toMatch(/h-11/);
      expect(trigger.className).toMatch(/w-11/);
      await userEvent.click(trigger);
      await userEvent.click(screen.getByRole('button', { name: 'Excluir Camiseta' }));

      expect(onDelete).toHaveBeenCalledWith(rows[0]);
      expect(screen.queryByText('Detalhe aberto')).not.toBeInTheDocument();
    });

    it('closes the menu with Escape', async () => {
      setViewport(375);
      renderTable();

      await userEvent.click(screen.getByRole('button', { name: 'Mais ações Camiseta' }));
      expect(screen.getByRole('button', { name: 'Excluir Camiseta' })).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');

      expect(screen.queryByRole('button', { name: 'Excluir Camiseta' })).not.toBeInTheDocument();
    });

    it('hides the menu when the actions column renders nothing (no permission)', () => {
      setViewport(375);
      const columns = makeColumns();
      columns[4] = { ...columns[4], cell: () => null };
      renderTable(columns);

      expect(screen.queryByRole('button', { name: /Mais ações/ })).not.toBeInTheDocument();
    });
  });
});
