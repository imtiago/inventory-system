interface Props {
  message: string;
  boxCode: string;
  onGenerateLabel(): void;
  onSkipLabel(): void;
}

export function InitialInventoryLabelChoice({ message, boxCode, onGenerateLabel, onSkipLabel }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-surface p-6 shadow">
        <h2 className="text-xl font-semibold">Unidades guardadas</h2>

        <div role="status" className="mt-4 rounded-lg border border-success/40 bg-success-soft p-4 text-success">
          {message}
        </div>
      </div>

      <div className="rounded-xl bg-surface p-6 shadow">
        <h3 className="text-lg font-semibold">Deseja gerar etiquetas?</h3>

        <p className="mt-2 text-sm text-muted">Etiquetas do produto para a caixa {boxCode}.</p>

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onGenerateLabel} className="rounded-lg bg-primary px-6 py-3 text-primary-foreground">
            Sim, gerar etiqueta
          </button>

          <button type="button" onClick={onSkipLabel} className="rounded-lg border border-input px-6 py-3">
            Não, finalizar
          </button>
        </div>
      </div>
    </div>
  );
}
