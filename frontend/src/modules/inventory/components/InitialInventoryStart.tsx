interface Props {
  onScanBarcode(): void;
  onRegisterWithoutBarcode(): void;
}

export function InitialInventoryStart({ onScanBarcode, onRegisterWithoutBarcode }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow">
        <h1 className="text-2xl font-semibold">Inventário Inicial</h1>

        <p className="mt-2 text-gray-600">Escolha como deseja iniciar o cadastro do produto.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <button type="button" onClick={onScanBarcode} className="rounded-xl bg-white p-6 text-left shadow transition hover:shadow-md">
          <div className="text-lg font-semibold">Ler código de barras</div>

          <p className="mt-2 text-sm text-gray-600">Utilize a câmera para identificar o produto automaticamente.</p>
        </button>

        <button type="button" onClick={onRegisterWithoutBarcode} className="rounded-xl bg-white p-6 text-left shadow transition hover:shadow-md">
          <div className="text-lg font-semibold">Cadastrar sem código de barras</div>

          <p className="mt-2 text-sm text-gray-600">Cadastre produtos que não possuem código de barras.</p>
        </button>
      </div>
    </div>
  );
}
