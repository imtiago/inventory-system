import { AlertTriangle } from "lucide-react";

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
  if (!open) {
    return null;
  }

  return (
    <div
      className="
        fixed inset-0
        bg-black/40
        flex
        items-center
        justify-center
        z-50
      "
    >
      <div
        className="
          w-full
          max-w-md
          bg-white
          rounded-xl
          shadow-xl
          p-6
        "
      >
        <div className="flex items-start gap-4">
          <div
            className="
              bg-red-100
              text-red-600
              p-3
              rounded-full
            "
          >
            <AlertTriangle size={24} />
          </div>

          <div className="flex-1">
            <h2 className="text-xl font-semibold">{title}</h2>

            <p className="mt-2 text-gray-600">{description}</p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="
              px-5
              py-2
              rounded-lg
              border
              hover:bg-gray-100
              disabled:opacity-50
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
              bg-red-600
              text-white
              hover:bg-red-700
              disabled:opacity-50
            "
          >
            {loading ? "Excluindo..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
