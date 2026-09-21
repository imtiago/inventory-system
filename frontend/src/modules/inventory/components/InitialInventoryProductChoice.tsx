interface InitialInventoryProductChoiceProps {
  barcode: string;
  onRegisterVariant: () => void;
  onRegisterProduct: () => void;
  onBack: () => void;
}

export function InitialInventoryProductChoice({ barcode, onRegisterVariant, onRegisterProduct, onBack }: InitialInventoryProductChoiceProps) {
  return (
    <>
      <div>
        <h1 className="text-3xl font-bold">Produto não encontrado</h1>

        <p className="text-gray-500">O código de barras foi lido, mas nenhuma variante foi encontrada.</p>
      </div>

      <div className="space-y-6 rounded-xl bg-white p-6 shadow">
        <div>
          <p className="text-sm text-gray-500">Código de barras</p>

          <p className="font-mono text-lg font-bold">{barcode}</p>
        </div>

        <div>
          <h2 className="text-xl font-bold">Esse produto já existe no cadastro?</h2>

          <p className="mt-2 text-gray-500">Se o produto já estiver cadastrado, vamos criar somente uma nova variante para ele.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <button type="button" onClick={onRegisterVariant} className="rounded-xl border p-6 text-left hover:bg-gray-50">
            <p className="text-lg font-bold">Sim, o produto existe</p>

            <p className="mt-2 text-sm text-gray-500">Pesquisar o produto e cadastrar somente a nova variante.</p>
          </button>

          <button type="button" onClick={onRegisterProduct} className="rounded-xl border p-6 text-left hover:bg-gray-50">
            <p className="text-lg font-bold">Não, é um produto novo</p>

            <p className="mt-2 text-sm text-gray-500">Cadastrar o produto e sua primeira variante.</p>
          </button>
        </div>

        <button type="button" onClick={onBack} className="rounded-lg border px-6 py-3">
          Voltar
        </button>
      </div>
    </>
  );
}
