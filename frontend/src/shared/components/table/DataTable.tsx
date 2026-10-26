import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useBreakpoint } from '@/shared/hooks/useMediaQuery';

import type { DataTableColumn, DataTableProps } from './types';

const alignment = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

/** Colunas numéricas (dinheiro, quantidades) ficam à direita, salvo alinhamento explícito. */
function alignOf<T>(column: DataTableColumn<T>): keyof typeof alignment {
  return column.align ?? (column.numeric ? 'right' : 'left');
}

function EmptyState({ message = 'Nenhum registro encontrado', hint = 'Tente novamente ou ajuste os filtros.' }: { message?: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
        <span className="text-xl text-subtle">—</span>
      </div>

      <p className="font-medium text-foreground">{message}</p>

      <p className="text-sm text-muted">{hint}</p>
    </div>
  );
}

/** Menu "⋯" do cartão: o conteúdo é a própria célula de ações (mesmas permissões e handlers). */
function ActionsMenu({ content, labelledBy }: { content: ReactNode; labelledBy: string }) {
  const [open, setOpen] = useState(false);
  const triggerId = useId();
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // A célula pode não renderizar nada (sem permissão): então não há menu a mostrar.
  useLayoutEffect(() => {
    if (root.current) root.current.hidden = panel.current?.querySelector('a, button') == null;
  }, [content]);

  // Cada ação só com ícone ganha o texto do seu aria-label/title: o menu é uma lista de linhas legíveis.
  useLayoutEffect(() => {
    panel.current?.querySelectorAll<HTMLElement>('a, button').forEach((el) => {
      if (el.querySelector('[data-menu-label]') || el.textContent?.trim()) return;
      const text = el.getAttribute('aria-label') ?? el.getAttribute('title');
      if (!text) return;
      const label = document.createElement('span');
      label.dataset.menuLabel = '';
      label.className = 'text-sm font-medium text-foreground';
      label.textContent = text;
      el.appendChild(label);
    });
  });

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: Event) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative shrink-0" data-card-actions>
      <button
        id={triggerId}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-labelledby={`${triggerId} ${labelledBy}`}
        onClick={() => setOpen((value) => !value)}
        className={`flex h-11 w-11 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground`}
      >
        <span className="sr-only">Mais ações</span>
        <MoreHorizontal size={20} aria-hidden="true" />
      </button>

      <div
        ref={panel}
        hidden={!open}
        className={`${open ? 'flex' : 'hidden'} absolute right-0 top-full z-20 mt-1 w-64 max-w-[calc(100vw-2rem)] flex-col items-stretch gap-1 rounded-lg border border-border bg-surface p-1 text-foreground shadow-lg [&_a]:flex [&_a]:min-h-[44px] [&_a]:w-full [&_a]:items-center [&_a]:justify-start [&_a]:gap-3 [&_a]:rounded-lg [&_a]:px-3 [&_a]:text-left [&_a]:hover:bg-surface-muted [&_button]:flex [&_button]:min-h-[44px] [&_button]:w-full [&_button]:items-center [&_button]:justify-start [&_button]:gap-3 [&_button]:rounded-lg [&_button]:px-3 [&_button]:text-left [&_button]:hover:bg-surface-muted [&_div]:contents`}
      >
        {content}
      </div>
    </div>
  );
}

function Card<T>({ row, columns, href }: { row: T; columns: DataTableColumn<T>[]; href?: string }) {
  const navigate = useNavigate();
  const titleId = useId();

  const visible = columns.filter((column) => column.mobile !== 'hidden');
  const title = visible.find((column) => column.mobile === 'title') ?? visible.find((column) => column.mobile !== 'actions' && column.mobile !== 'subtitle');
  const subtitles = visible.filter((column) => column.mobile === 'subtitle' && column !== title);
  const actions = visible.find((column) => column.mobile === 'actions');
  const meta = visible.filter((column) => column !== title && column !== actions && !subtitles.includes(column));

  function open(event: MouseEvent<HTMLElement>) {
    if (!href) return;
    // Links e botões internos (título, menu) cuidam do próprio clique.
    if ((event.target as HTMLElement).closest('a, button, input, select, textarea, [data-card-actions]')) return;
    navigate(href);
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (href && event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      navigate(href);
    }
  }

  return (
    <li onClick={open} onKeyDown={onKeyDown} tabIndex={href ? 0 : undefined} aria-labelledby={href ? titleId : undefined} className={`rounded-xl border border-border bg-surface p-4 text-foreground shadow ${href ? 'cursor-pointer active:bg-surface-muted' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {title && (
            <div id={titleId} className="break-words font-medium text-foreground">
              {title.cell(row)}
            </div>
          )}
          {subtitles.map((column) => (
            <div key={column.id} className="break-words text-sm text-muted">
              {column.cell(row)}
            </div>
          ))}
        </div>

        {actions && <ActionsMenu content={actions.cell(row)} labelledBy={titleId} />}
      </div>

      {meta.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {meta.map((column) => (
            <div key={column.id} className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-muted">{column.header}</dt>
              <dd className={`break-words text-foreground ${column.numeric ? 'tabular-nums' : ''}`}>{column.cell(row)}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

export function DataTable<T>({ data, columns, getRowId, getRowHref, emptyMessage, emptyHint }: DataTableProps<T>) {
  const isTabletUp = useBreakpoint('md');

  if (!isTabletUp) {
    if (data.length === 0) {
      return (
        <div className="px-5 py-12 text-center">
          <EmptyState message={emptyMessage} hint={emptyHint} />
        </div>
      );
    }

    return (
      <ul className="flex flex-col gap-3 p-3">
        {data.map((row, index) => (
          <Card key={getRowId ? getRowId(row) : index} row={row} columns={columns} href={getRowHref?.(row)} />
        ))}
      </ul>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-surface-muted">
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                style={{ width: column.width }}
                className={`whitespace-nowrap border-b border-border px-3 py-4 text-xs font-semibold uppercase tracking-wide text-muted first:rounded-tl-xl last:rounded-tr-xl lg:px-5 ${alignment[alignOf(column)]}`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-border">
          {data.map((row, index) => (
            <tr key={getRowId ? getRowId(row) : index} className="bg-surface transition-colors hover:bg-surface-muted">
              {columns.map((column) => (
                <td key={column.id} className={`px-3 py-4 align-middle text-foreground lg:px-5 ${alignment[alignOf(column)]} ${column.numeric ? 'whitespace-nowrap tabular-nums' : ''}`}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}

          {data.length === 0 && (
            <tr>
              <td colSpan={Math.max(columns.length, 1)} className="px-5 py-12 text-center">
                <EmptyState message={emptyMessage} hint={emptyHint} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
