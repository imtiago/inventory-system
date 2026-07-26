// src/shared/components/crud/CrudPage.tsx

import type { ReactNode } from "react";

interface CrudPageProps {
  children: ReactNode;
}

export function CrudPage({ children }: CrudPageProps) {
  return (
    <div
      className="
        h-full
        flex
        flex-col
        gap-6
      "
    >
      {children}
    </div>
  );
}
