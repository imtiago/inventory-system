// src/shared/components/crud/CrudBadge.tsx

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import type { Tone } from "@/shared/utils/statusTone";

interface CrudBadgeProps {
  children: ReactNode;
  /** Padrão `info` (o visual de sempre). Para status, prefira `StatusBadge`, que tira a cor do `statusTone`. */
  tone?: Tone;
}

export function CrudBadge({ children, tone = "info" }: CrudBadgeProps) {
  return <Badge tone={tone}>{children}</Badge>;
}
