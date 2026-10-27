import type { ReactNode } from 'react';

export interface DataTableColumn<T> {
  id: string;

  header: ReactNode;

  width?: string;

  align?: 'left' | 'center' | 'right';

  /** Valor numérico (dinheiro, quantidade): à direita, com algarismos tabulares e sem quebra de linha. */
  numeric?: boolean;

  cell: (row: T) => ReactNode;

  /**
   * Papel da coluna nos cartões (abaixo de `md`): `title` e `subtitle` em destaque, `meta` em
   * "rótulo: valor", `hidden` omitida, `actions` vira o menu "⋯" (mesmo conteúdo da célula, com
   * as mesmas permissões e handlers). Sem valor, a coluna é `meta`.
   */
  mobile?: DataTableMobileRole;
}

export type DataTableMobileRole = 'title' | 'subtitle' | 'meta' | 'hidden' | 'actions';

export interface DataTableProps<T> {
  data: T[];

  columns: DataTableColumn<T>[];

  loading?: boolean;

  /** Título da lista vazia, específico da lista (ex.: "Nenhuma venda encontrada"). */
  emptyMessage?: string;

  /** Texto de apoio abaixo do título da lista vazia. */
  emptyHint?: string;

  getRowId?: (row: T) => string;

  /** Quando a linha leva a um detalhe, o cartão inteiro (abaixo de `md`) abre esse caminho. */
  getRowHref?: (row: T) => string | undefined;

  className?: string;

  stickyHeader?: boolean;

  /** Id do título que nomeia a tabela (ou a lista de cartões) para leitores de tela. */
  ariaLabelledBy?: string;
}
