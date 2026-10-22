interface Props {
  message: string;
  boxCode: string;
  onGenerateLabel(): void;
  onSkipLabel(): void;
}

export function InitialInventoryLabelChoice({ message, boxCode, onGenerateLabel, onSkipLabel }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold">Unidades guardadas</h2>

        <div role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
          {message}
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow">
        <h3 className="text-lg font-semibold">Deseja gerar etiquetas?</h3>

        <p className="mt-2 text-sm text-gray-500">Etiquetas do produto para a caixa {boxCode}.</p>

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onGenerateLabel} className="rounded-lg bg-black px-6 py-3 text-white">
            Sim, gerar etiqueta
          </button>

          <button type="button" onClick={onSkipLabel} className="rounded-lg border border-gray-300 px-6 py-3">
            Não, finalizar
          </button>
        </div>
      </div>
    </div>
  );
}
