// src/shared/components/crud/CrudBadge.tsx

import type { ReactNode } from "react";

interface CrudBadgeProps {
  children: ReactNode;
}

export function CrudBadge({ children }: CrudBadgeProps) {
  return (
    <span
      className="
        bg-blue-100
        text-blue-700
        rounded-full
        px-3
        py-1
        text-sm
      "
    >
      {children}
    </span>
  );
}
