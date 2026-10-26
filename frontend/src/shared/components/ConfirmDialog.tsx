import { useId, useRef } from "react";
import { AlertTriangle } from "lucide-react";

import { useDialogBehavior } from "./Modal/useDialogBehavior";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
  onConfirm(): void;
  onCancel(): void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "Excluir",
  cancelText = "Cancelar",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Destructive confirmation: focus starts on cancel; Escape cancels unless the action is running.
  useDialogBehavior({ open, dialogRef, onEscape: onCancel, escapeEnabled: !loading, getInitialFocus: () => cancelRef.current });

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      ref={dialogRef}
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby={titleId}
      className="
        fixed inset-0
        bg-overlay
        flex
        items-center
        justify-center
        z-50
        p-4
      "
    >
      <div
        className="
          w-full
          max-w-md
          max-h-[90dvh]
          overflow-y-auto
          bg-surface
          text-foreground
          border
          border-border
          rounded-xl
          shadow-xl
          p-6
        "
      >
        <div className="flex items-start gap-4">
          <div
            className="
              bg-danger-soft
              text-danger
              p-3
              rounded-full
            "
          >
            <AlertTriangle size={24} />
          </div>

          <div className="flex-1">
            <h2 id={titleId} className="text-xl font-semibold">{title}</h2>

            <p className="mt-2 text-muted">{description}</p>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 mt-8">
          <button
            type="button"
            ref={cancelRef}
            onClick={onCancel}
            disabled={loading}
            className="
              px-5
              py-2
              rounded-lg
              border
              border-input
              bg-surface
              text-foreground
              hover:bg-surface-muted
              disabled:opacity-60
            "
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="
              px-5
              py-2
              rounded-lg
              bg-danger-solid
              text-danger-foreground
              hover:bg-danger
              disabled:opacity-60
            "
          >
            {loading ? "Excluindo..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
