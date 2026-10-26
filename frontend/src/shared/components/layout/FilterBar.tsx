import type { ReactNode } from "react";

/** Grade padrão dos filtros: colunas de pelo menos 13rem, então nenhum select ou busca é cortado. */
export const FILTER_GRID = "grid grid-cols-1 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] sm:items-start";

export const FILTER_LABEL = "mb-1.5 block text-sm font-medium text-foreground";

export const FILTER_FIELD =
  "h-11 w-full rounded-lg border border-input bg-surface px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20";

/** Faixa de filtros dentro do cartão da lista: mesmo recuo e divisória em todas as telas. */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 border-b border-border p-4 sm:p-5">{children}</div>;
}
