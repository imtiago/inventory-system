interface Props {
  boxCode: string;
  labelQuantity: number;
  onGenerateLabel(): void;
  onSkipLabel(): void;
}

export function InitialInventoryLabelChoice({ boxCode, labelQuantity, onGenerateLabel, onSkipLabel }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold">Unidade adicionada</h2>

        <p className="mt-2 text-gray-600">A unidade foi adicionada ao estoque com sucesso.</p>

        <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-700">Caixa</p>

          <p className="mt-1 text-lg font-semibold text-green-900">{boxCode}</p>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow">
        <h3 className="text-lg font-semibold">Deseja gerar uma etiqueta?</h3>

        <p className="mt-2 text-sm text-gray-500">Você pode gerar a etiqueta para identificar esta unidade.</p>

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
