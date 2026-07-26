import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  id: string;

  header: ReactNode;

  width?: string;

  align?: "left" | "center" | "right";

  cell: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  data: T[];

  columns: DataTableColumn<T>[];

  loading?: boolean;

  emptyMessage?: string;

  getRowId?: (row: T) => string;

  className?: string;

  stickyHeader?: boolean;
}
