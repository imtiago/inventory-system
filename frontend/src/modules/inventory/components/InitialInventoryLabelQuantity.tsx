interface Props {
  boxCode: string;
  quantity: number;
  onChange(quantity: number): void;
  onConfirm(): void;
  onCancel(): void;
}

export function InitialInventoryLabelQuantity({ boxCode, quantity, onChange, onConfirm, onCancel }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold">Gerar etiquetas</h2>

        <div className="mt-4 rounded-lg border bg-gray-50 p-4">
          <p className="text-sm text-gray-500">Caixa</p>

          <p className="mt-1 text-lg font-semibold">{boxCode}</p>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow">
        <label htmlFor="label-quantity" className="mb-2 block font-medium">
          Quantidade de etiquetas
        </label>

        <input id="label-quantity" type="number" min={1} step={1} value={quantity} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-lg border p-3" />

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onConfirm} disabled={quantity < 1} className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50">
            Gerar etiquetas
          </button>

          <button type="button" onClick={onCancel} className="rounded-lg border border-gray-300 px-6 py-3">
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
