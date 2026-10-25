// shared/components/layout/Page.tsx

import type { ReactNode } from "react";

interface PageProps {
  children: ReactNode;
}

export function Page({ children }: PageProps) {
  return (
    <div
      className="
        lg:h-full
        min-h-0
        flex
        flex-col
        lg:overflow-hidden
      "
    >
      {children}
    </div>
  );
}
