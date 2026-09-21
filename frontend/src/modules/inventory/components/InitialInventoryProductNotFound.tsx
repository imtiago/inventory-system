interface InitialInventoryProductNotFoundProps {
  barcode: string;
  onContinue: () => void;
}

export function InitialInventoryProductNotFound({ barcode, onContinue }: InitialInventoryProductNotFoundProps) {
  return (
    <div className="rounded-xl bg-white p-6 shadow">
      <p className="text-sm text-gray-500">Produto não encontrado</p>

      <h2 className="text-xl font-bold">Este código de barras ainda não está cadastrado.</h2>

      <p className="mt-2 font-mono">{barcode}</p>

      <button type="button" onClick={onContinue} className="mt-6 w-full rounded-lg bg-black px-6 py-3 text-white">
        Continuar cadastro
      </button>
    </div>
  );
}
