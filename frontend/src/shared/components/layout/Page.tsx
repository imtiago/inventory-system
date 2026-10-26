// shared/components/layout/Page.tsx

import type { ReactNode } from "react";

interface PageProps {
  children: ReactNode;
  /**
   * `wide` (padrão): listas, até 1440 px. `narrow`: formulários e detalhes, até 1100 px.
   * Sempre centralizado; a rolagem é da página (o `<main>` do layout), nunca de um bloco interno.
   */
  width?: "wide" | "narrow";
}

const widths = {
  wide: "max-w-[1440px]",
  narrow: "max-w-[1100px]",
} as const;

export function Page({ children, width = "wide" }: PageProps) {
  return <div className={`mx-auto flex w-full min-w-0 flex-col gap-6 ${widths[width]}`}>{children}</div>;
}
