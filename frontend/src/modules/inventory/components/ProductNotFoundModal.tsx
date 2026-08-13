interface ProductNotFoundModalProps {
  barcode: string;
  onClose: () => void;
  onRegister: () => void;
}

export function ProductNotFoundModal({
  barcode,
  onClose,
  onRegister,
}: ProductNotFoundModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold">Produto não cadastrado</h2>

        <p className="mt-2 text-sm text-gray-500">
          O código de barras abaixo não está cadastrado no sistema.
        </p>

        <div className="mt-4 rounded-lg bg-gray-100 p-4 text-center font-mono text-lg">
          {barcode}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border px-4 py-3"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onRegister}
            className="flex-1 rounded-lg bg-black px-4 py-3 text-white"
          >
            Cadastrar produto
          </button>
        </div>
      </div>
    </div>
  );
}
