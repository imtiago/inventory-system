import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { useDialogBehavior } from "@/shared/components/Modal/useDialogBehavior";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Menu sobreposto: fundo escurecido, foco preso, Escape e toque fora fecham (lógica compartilhada com o Modal). */
export function MobileDrawer({ open, onClose, children }: MobileDrawerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogBehavior({ open, dialogRef, onEscape: onClose });

  if (!open) return null;

  return createPortal(
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Menu" tabIndex={-1} className="fixed inset-0 z-40 flex outline-none">
      <div className="relative h-full w-64 max-w-[85vw] overscroll-contain">
        {children}
        <button type="button" onClick={onClose} aria-label="Fechar menu" className="absolute right-2 top-3 flex h-11 w-11 items-center justify-center rounded-lg text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-foreground">
          <X size={22} />
        </button>
      </div>
      <div data-testid="drawer-backdrop" onClick={onClose} className="flex-1 bg-overlay" />
    </div>,
    document.body,
  );
}
