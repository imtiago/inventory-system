interface InitialInventoryProductChoiceProps {
  barcode?: string | null;
  onRegisterVariant: () => void;
  onRegisterProduct: () => void;
  onBack: () => void;
}

export function InitialInventoryProductChoice({ barcode, onRegisterVariant, onRegisterProduct, onBack }: InitialInventoryProductChoiceProps) {
  const hasBarcode = Boolean(barcode);

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold">{hasBarcode ? 'Produto não encontrado' : 'Cadastro do produto'}</h1>

        <p className="text-muted">
          {hasBarcode ? 'O código de barras foi lido, mas nenhuma variante foi encontrada.' : 'Informe se o produto já existe no cadastro ou se será necessário criar um novo produto.'}
        </p>
      </div>

      <div className="space-y-6 rounded-xl bg-surface p-6 shadow">
        {hasBarcode && (
          <div>
            <p className="text-sm text-muted">Código de barras</p>

            <p className="font-mono text-lg font-bold">{barcode}</p>
          </div>
        )}

        <div>
          <h2 className="text-xl font-bold">Esse produto já existe no cadastro?</h2>

          <p className="mt-2 text-muted">Se o produto já estiver cadastrado, vamos localizar o produto e cadastrar somente uma nova variante.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <button type="button" onClick={onRegisterVariant} className="rounded-xl border p-6 text-left hover:bg-surface-muted">
            <p className="text-lg font-bold">Sim, o produto existe</p>

            <p className="mt-2 text-sm text-muted">Pesquisar o produto e cadastrar somente uma nova variante.</p>
          </button>

          <button type="button" onClick={onRegisterProduct} className="rounded-xl border p-6 text-left hover:bg-surface-muted">
            <p className="text-lg font-bold">Não, é um produto novo</p>

            <p className="mt-2 text-sm text-muted">Cadastrar o produto e sua primeira variante.</p>
          </button>
        </div>

        <button type="button" onClick={onBack} className="rounded-lg border border-input bg-surface text-foreground px-6 py-3">
          Voltar
        </button>
      </div>
    </>
  );
}
