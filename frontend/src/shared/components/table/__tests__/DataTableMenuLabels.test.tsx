import { MemoryRouter } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pencil, Trash2 } from 'lucide-react';
import { describe, expect, it } from 'vitest';

import { setViewport } from '@/test/viewport';

import { DataTable } from '../DataTable';
import type { DataTableColumn } from '../types';

interface Row {
  id: string;
  name: string;
}

const columns: DataTableColumn<Row>[] = [
  { id: 'name', header: 'Nome', mobile: 'title', cell: (r) => r.name },
  {
    id: 'actions',
    header: 'Ações',
    mobile: 'actions',
    cell: (r) => (
      <div className="flex gap-2">
        <a href={`/x/${r.id}`} aria-label={`Editar ${r.name}`}>
          <Pencil size={16} />
        </a>
        <button type="button" title={`Excluir ${r.name}`}>
          <Trash2 size={16} />
        </button>
      </div>
    ),
  },
];

function renderTable(props: { emptyMessage?: string; data?: Row[] } = {}) {
  return render(
    <MemoryRouter>
      <DataTable data={props.data ?? [{ id: '1', name: 'Camiseta' }]} columns={columns} getRowId={(r) => r.id} emptyMessage={props.emptyMessage} />
    </MemoryRouter>,
  );
}

describe('DataTable: menu "⋯" do cartão', () => {
  it('mostra cada ação com ícone e texto (aria-label ou title) em linhas de largura total e 44 px', async () => {
    setViewport(375);
    renderTable();
    await userEvent.click(screen.getByRole('button', { name: /Mais ações/ }));

    const edit = screen.getByRole('link', { name: 'Editar Camiseta' });
    const remove = screen.getByTitle('Excluir Camiseta');
    expect(within(edit).getByText('Editar Camiseta')).toBeInTheDocument();
    expect(within(remove).getByText('Excluir Camiseta')).toBeInTheDocument();
    expect(edit.querySelector('svg')).not.toBeNull();
    const panel = edit.closest('[data-card-actions] > div')?.className ?? '';
    expect(panel).toMatch(/\[&_a\]:min-h-\[44px\]/);
    expect(panel).toMatch(/\[&_a\]:w-full/);
    expect(panel).toMatch(/\[&_button\]:min-h-\[44px\]/);
    expect(panel).toMatch(/\[&_button\]:w-full/);
  });

  it('não duplica o texto quando a ação já tem rótulo visível', async () => {
    setViewport(375);
    render(
      <MemoryRouter>
        <DataTable
          data={[{ id: '1', name: 'Camiseta' }]}
          columns={[
            columns[0],
            { id: 'actions', header: 'Ações', mobile: 'actions', cell: () => <button type="button">Cancelar</button> },
          ]}
          getRowId={(r) => r.id}
        />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /Mais ações/ }));
    expect(screen.getAllByText('Cancelar')).toHaveLength(1);
  });
});

describe('DataTable: mensagem de lista vazia por lista (M1)', () => {
  it('usa a mensagem recebida, na tabela e nos cartões', () => {
    renderTable({ data: [], emptyMessage: 'Nenhuma venda encontrada' });
    expect(screen.getByText('Nenhuma venda encontrada')).toBeInTheDocument();
    expect(screen.queryByText(/cliente/i)).not.toBeInTheDocument();
  });

  it('em cartões também', () => {
    setViewport(375);
    renderTable({ data: [], emptyMessage: 'Nenhum produto encontrado' });
    expect(screen.getByText('Nenhum produto encontrado')).toBeInTheDocument();
  });

  it('sem mensagem, o texto é genérico e não fala de cliente', () => {
    renderTable({ data: [] });
    expect(screen.getByText('Nenhum registro encontrado')).toBeInTheDocument();
    expect(screen.queryByText(/cliente/i)).not.toBeInTheDocument();
  });
});
