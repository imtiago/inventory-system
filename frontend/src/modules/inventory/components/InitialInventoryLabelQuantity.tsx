import { QuantityInput } from '@/shared/components/form';

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
      <div className="rounded-xl bg-surface p-6 shadow">
        <h2 className="text-xl font-semibold">Gerar etiquetas</h2>

        <div className="mt-4 rounded-lg border bg-surface-muted p-4">
          <p className="text-sm text-muted">Caixa</p>

          <p className="mt-1 text-lg font-semibold">{boxCode}</p>
        </div>
      </div>

      <div className="rounded-xl bg-surface p-6 shadow">
        <label htmlFor="label-quantity" className="mb-2 block font-medium">
          Quantidade de etiquetas
        </label>

        <QuantityInput id="label-quantity" min={1} value={String(quantity)} onChange={onChange} />

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger-soft p-4 text-danger">
            {error}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button type="submit" disabled={loading} className="rounded-lg bg-primary px-6 py-3 text-primary-foreground disabled:opacity-50">
            {loading ? 'Gerando etiquetas...' : 'Gerar etiquetas'}
          </button>

          <button type="button" onClick={onCancel} className="rounded-lg border border-input px-6 py-3">
            Voltar
          </button>
        </div>
      </div>
    </form>
  );
}
