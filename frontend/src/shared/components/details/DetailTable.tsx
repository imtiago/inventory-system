import type { ReactNode } from 'react';

import { useBreakpoint } from '@/shared/hooks/useMediaQuery';

export interface DetailTableColumn<T> {
  id: string;
  header: string;
  /** `right` para números (dinheiro, quantidades): ficam com algarismos tabulares e sem quebra. */
  align?: 'left' | 'right';
  cell: (row: T) => ReactNode;
  /** Abaixo de `md`: `title` fica em destaque no topo do cartão; o resto vira "rótulo: valor". */
  mobile?: 'title' | 'meta';
}

interface DetailTableProps<T> {
  columns: DetailTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
}

/** Espaço lateral entre colunas (uma coluna à direita não encosta na seguinte); a 1ª e a última alinham com o texto ao redor. */
const cellBase = 'px-3 py-2 first:pl-0 last:pr-0';
const alignClass = (column: { align?: 'left' | 'right' }) => (column.align === 'right' ? 'text-right tabular-nums whitespace-nowrap' : 'text-left');

/** Tabela simples das páginas de detalhe; abaixo de `md` cada linha vira um cartão empilhado. */
export function DetailTable<T>({ columns, rows, getRowId }: DetailTableProps<T>) {
  const isMd = useBreakpoint('md');

  if (!isMd) {
    const title = columns.find((column) => column.mobile === 'title');
    const meta = columns.filter((column) => column !== title);

    return (
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={getRowId(row)} className="rounded-xl border border-border bg-surface p-3 text-foreground">
            {title && <div className="break-words font-medium">{title.cell(row)}</div>}
            <dl className={`${title ? 'mt-2 ' : ''}grid grid-cols-2 gap-x-4 gap-y-2 text-sm`}>
              {meta.map((column) => (
                <div key={column.id} className="min-w-0">
                  <dt className="text-xs uppercase tracking-wide text-muted">{column.header}</dt>
                  <dd className={`break-words text-foreground ${column.align === 'right' ? 'tabular-nums' : ''}`}>{column.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map((column) => (
              <th key={column.id} className={`${cellBase} ${alignClass(column)} font-semibold text-muted`}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowId(row)} className="border-b border-border">
              {columns.map((column) => (
                <td key={column.id} className={`${cellBase} ${alignClass(column)} text-foreground`}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
