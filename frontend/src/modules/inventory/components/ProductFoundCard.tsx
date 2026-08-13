interface Product {
  id: string;
  code: string;
  name: string;
  barcode: string | null;
}

interface ProductFoundCardProps {
  product: Product;
  onContinue: () => void;
}

export function ProductFoundCard({
  product,
  onContinue,
}: ProductFoundCardProps) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Produto encontrado</p>

          <h2 className="text-xl font-semibold">{product.name}</h2>
        </div>

        <span className="rounded-lg bg-gray-100 px-3 py-2 font-mono font-semibold">
          {product.code}
        </span>
      </div>

      <div className="text-sm text-gray-500">Código de barras</div>

      <div className="font-mono">{product.barcode ?? "-"}</div>

      <button
        type="button"
        onClick={onContinue}
        className="mt-6 w-full rounded-lg bg-black px-4 py-3 font-medium text-white hover:bg-gray-800"
      >
        Continuar
      </button>
    </div>
  );
}
