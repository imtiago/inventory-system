// shared/components/details/DetailsGrid.tsx

import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export function DetailsGrid({ children }: Props) {
  return (
    <div
      className="
        grid
        grid-cols-4
        gap-6
      "
    >
      {children}
    </div>
  );
}
