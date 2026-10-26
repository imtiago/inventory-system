import type { HTMLAttributes } from "react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { toneFor, type Tone } from "@/shared/utils/statusTone";

const badgeVariants = cva(
  "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium leading-5",
  {
    variants: {
      tone: {
        neutral: "bg-surface-muted text-muted ring-1 ring-inset ring-border",
        info: "bg-info-soft text-info",
        success: "bg-success-soft text-success",
        warning: "bg-warning-soft text-warning",
        danger: "bg-danger-soft text-danger",
      } satisfies Record<Tone, string>,
    },
    defaultVariants: { tone: "neutral" },
  },
);

type BadgeProps = HTMLAttributes<HTMLSpanElement> & { tone?: Tone };

/** Pílula de status/rótulo; não quebra linha. */
export function Badge({ tone, className, ...props }: BadgeProps) {
  return <span {...props} className={cn(badgeVariants({ tone }), className)} />;
}

type StatusBadgeProps = Omit<BadgeProps, "tone"> & { status: string | null | undefined };

/** Badge cuja cor vem do mapa único `statusTone`; o texto (rótulo traduzido) vem em `children`. */
export function StatusBadge({ status, ...props }: StatusBadgeProps) {
  return <Badge tone={toneFor(status)} data-status={status ?? undefined} {...props} />;
}
