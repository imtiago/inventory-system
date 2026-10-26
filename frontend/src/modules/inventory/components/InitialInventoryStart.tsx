interface Props {
  onScanBarcode(): void;
  onRegisterWithoutBarcode(): void;
}

export function InitialInventoryStart({ onScanBarcode, onRegisterWithoutBarcode }: Props) {
  return (
    <div className="space-y-6">
      <p className="text-muted">Escolha como deseja iniciar o cadastro do produto.</p>

      <div className="grid gap-4 md:grid-cols-2">
        <button type="button" onClick={onScanBarcode} className="flex flex-col items-start justify-start rounded-xl border border-border bg-surface p-6 text-left shadow transition hover:bg-surface-muted">
          <div className="text-lg font-semibold">Ler código de barras</div>

          <p className="mt-2 text-sm text-muted">Utilize a câmera para identificar o produto automaticamente.</p>
        </button>

        <button type="button" onClick={onRegisterWithoutBarcode} className="flex flex-col items-start justify-start rounded-xl border border-border bg-surface p-6 text-left shadow transition hover:bg-surface-muted">
          <div className="text-lg font-semibold">Cadastrar sem código de barras</div>

          <p className="mt-2 text-sm text-muted">Cadastre produtos que não possuem código de barras.</p>
        </button>
      </div>
    </div>
  );
}
