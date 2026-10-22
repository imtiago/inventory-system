interface Props {
  boxCode: string;
  /** Raw text so the field can be cleared while typing; validated on submit. */
  quantity: string;

  loading: boolean;
  error: string | null;

  onChange(quantity: string): void;
  onConfirm(): void;
  onCancel(): void;
}

export function InitialInventoryLabelQuantity({ boxCode, quantity, onChange, onConfirm, onCancel, loading, error }: Props) {
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onConfirm();
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-6">
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

        <input id="label-quantity" type="number" inputMode="numeric" min={1} step={1} value={quantity} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border p-3" />

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button type="submit" disabled={loading} className="rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50">
            {loading ? 'Gerando etiquetas...' : 'Gerar etiquetas'}
          </button>

          <button type="button" onClick={onCancel} className="rounded-lg border border-gray-300 px-6 py-3">
            Voltar
          </button>
        </div>
      </div>
    </form>
  );
}
