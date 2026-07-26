// shared/components/layout/Page.tsx

import type { ReactNode } from "react";

interface PageProps {
  children: ReactNode;
}

export function Page({ children }: PageProps) {
  return (
    <div
      className="
        h-full
        min-h-0
        flex
        flex-col
        overflow-hidden
      "
    >
      {children}
    </div>
  );
}
