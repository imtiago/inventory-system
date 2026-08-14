import { useEffect, useState } from 'react';

import { BarcodeScanner } from '@/components/BarcodeScanner';

import { useProductByBarcode } from '../hooks/useProductByBarcode';
import { useInventoryBoxByLot } from '../hooks/useInventoryBoxByLot';

import { InventoryLotForm, type InventoryLotFormData } from '../components/InventoryLotForm';

import { ProductVariantRegistration } from '../components/ProductVariantRegistration';

interface ProductVariant {
  id: string;
  name: string;
  code: string;
  barcode: string | null;
  productId: string;
}

export function InitialInventoryPage() {
  const [scannerOpen, setScannerOpen] = useState(false);

  const [barcode, setBarcode] = useState('');

  const [step, setStep] = useState<'scan' | 'product-choice' | 'register-product' | 'register-variant' | 'lot'>('scan');

  /*
   * Variante criada durante o fluxo.
   *
   * Isso é importante porque, quando o barcode não existe,
   * o hook useProductByBarcode não terá um "product".
   */
  const [createdVariant, setCreatedVariant] = useState<ProductVariant | null>(null);

  const [boxCode, setBoxCode] = useState<string | null>(null);

  const [boxLocked, setBoxLocked] = useState(false);

  const [expirationDate, setExpirationDate] = useState<string | null>(null);

  const [expirationLocked, setExpirationLocked] = useState(false);

  /*
   * Produto encontrado pelo barcode.
   */
  const { product, notFoundBarcode, loading, findByBarcode, clear } = useProductByBarcode();

  /*
   * Consulta caixa/lote.
   */
  const { loading: boxLoading, error: boxError, findBoxByLot, clearBox } = useInventoryBoxByLot();

  /*
   * ============================================================
   * VARIÁVEL PRINCIPAL DO FLUXO
   * ============================================================
   *
   * Se a variante foi recém-criada, usamos ela.
   *
   * Caso contrário, usamos a variante encontrada pelo barcode.
   */
  const currentVariant = createdVariant ?? product;

  /*
   * ============================================================
   * QUANDO O PRODUTO FOR ENCONTRADO
   * ============================================================
   *
   * Se o barcode já existir, automaticamente vamos para
   * o cadastro do lote.
   */
  useEffect(() => {
    if (step === 'scan' && !loading && product) {
      setStep('lot');
    }
  }, [product, loading, step]);

  /*
   * ============================================================
   * BARCODE LIDO
   * ============================================================
   */
  function handleBarcodeRead(code: string) {
    const normalizedCode = code.trim();

    if (!normalizedCode) {
      return;
    }

    /*
     * Guarda o barcode atual.
     */
    setBarcode(normalizedCode);

    /*
     * Fecha scanner.
     */
    setScannerOpen(false);

    /*
     * Limpa informações anteriores.
     */
    setCreatedVariant(null);

    setBoxCode(null);
    setBoxLocked(false);

    setExpirationDate(null);
    setExpirationLocked(false);

    clearBox();

    /*
     * Garante que estamos no fluxo de scanner.
     */
    setStep('scan');

    /*
     * Consulta o backend.
     */
    findByBarcode(normalizedCode);
  }

  /*
   * ============================================================
   * CONTINUAR CADASTRO
   * ============================================================
   *
   * Barcode não foi encontrado.
   */
  function handleRegisterProduct() {
    if (!notFoundBarcode) {
      return;
    }

    setStep('product-choice');
  }

  /*
   * ============================================================
   * PRODUTO JÁ EXISTE
   * ============================================================
   *
   * Vamos pesquisar o Product e criar uma nova ProductVariant.
   */
  function handleRegisterVariant() {
    if (!notFoundBarcode) {
      return;
    }

    setStep('register-variant');
  }

  /*
   * ============================================================
   * VARIANTE CRIADA
   * ============================================================
   */
  function handleVariantCreated(variant: ProductVariant) {
    console.log('Variante criada:', variant);

    /*
     * Guarda a variante criada.
     */
    setCreatedVariant(variant);

    /*
     * Confirmação para o usuário.
     */
    alert(`Variante cadastrada com sucesso!\n\nCódigo: ${variant.code}`);

    /*
     * Limpa dados antigos de caixa/validade.
     */
    setBoxCode(null);
    setBoxLocked(false);

    setExpirationDate(null);
    setExpirationLocked(false);

    clearBox();

    /*
     * Vai para o cadastro do lote.
     */
    setStep('lot');
  }

  /*
   * ============================================================
   * CONSULTAR LOTE
   * ============================================================
   */
  async function handleBatchBlur(batchNumber: string) {
    /*
     * Usa a variante recém-criada ou a variante encontrada.
     */
    const current = createdVariant ?? product;

    if (!current) {
      return;
    }

    const normalizedBatch = batchNumber.trim();

    if (!normalizedBatch) {
      return;
    }

    /*
     * Limpa informações anteriores.
     */
    setBoxCode(null);
    setBoxLocked(false);

    setExpirationDate(null);
    setExpirationLocked(false);

    clearBox();

    /*
     * Consulta a caixa relacionada ao lote.
     */
    const foundBox = await findBoxByLot(current.id, normalizedBatch);

    /*
     * Lote ainda não existe.
     *
     * O usuário poderá informar a caixa e a validade.
     */
    if (!foundBox) {
      return;
    }

    /*
     * Caixa encontrada.
     */
    setBoxCode(foundBox.code);
    setBoxLocked(true);

    /*
     * Procura o estoque correspondente ao lote.
     */
    const stock = foundBox.stocks.find((item) => item.productVariant.id === current.id && item.inventoryLot.batchNumber === normalizedBatch);

    /*
     * Existe lote, mas não existe validade.
     */
    if (!stock || !stock.inventoryLot.expirationDate) {
      setExpirationDate(null);
      setExpirationLocked(false);

      return;
    }

    /*
     * Converte:
     *
     * 2027-08-13T00:00:00.000Z
     *
     * para:
     *
     * 2027-08-13
     */
    const formattedDate = new Date(stock.inventoryLot.expirationDate).toISOString().split('T')[0];

    setExpirationDate(formattedDate);
    setExpirationLocked(true);
  }

  /*
   * ============================================================
   * REGISTRAR ESTOQUE
   * ============================================================
   */
  function handleLotSubmit(data: InventoryLotFormData) {
    const current = createdVariant ?? product;

    if (!current) {
      return;
    }

    console.log('=================================');
    console.log('REGISTRO DE ESTOQUE');
    console.log('=================================');

    console.log('Variante:', current);

    console.log('Variant ID:', current.id);

    console.log('Barcode:', current.barcode ?? barcode);

    console.log('Lote:', data.batchNumber);

    console.log('Validade:', data.expirationDate);

    console.log('Caixa:', data.boxCode);

    console.log('Quantidade:', data.quantity);

    /*
     * TODO:
     *
     * Chamar API de inventário inicial.
     *
     * Exemplo:
     *
     * await api.post("/inventory/initial", {
     *   productVariantId: current.id,
     *   batchNumber: data.batchNumber,
     *   expirationDate: data.expirationDate,
     *   boxCode: data.boxCode,
     *   quantity: data.quantity,
     * });
     */
  }

  /*
   * ============================================================
   * VOLTAR PARA O SCANNER
   * ============================================================
   */
  function handleBackToScan() {
    setStep('scan');

    setBarcode('');

    setCreatedVariant(null);

    setBoxCode(null);
    setBoxLocked(false);

    setExpirationDate(null);
    setExpirationLocked(false);

    setScannerOpen(false);

    clearBox();

    clear();
  }

  /*
   * ============================================================
   * CANCELAR CADASTRO DO PRODUTO
   * ============================================================
   */
  function handleCancelProductRegistration() {
    handleBackToScan();
  }

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div className="space-y-6">
      {/* ====================================================== */}
      {/* SCANNER                                                */}
      {/* ====================================================== */}

      {step === 'scan' && (
        <>
          <div>
            <h1 className="text-3xl font-bold">Inventário Inicial</h1>

            <p className="text-gray-500">Escaneie os produtos para realizar a contagem inicial do estoque.</p>
          </div>

          <div className="space-y-5 rounded-xl bg-white p-6 shadow">
            <div>
              <label className="mb-1 block">Código de barras</label>

              <div className="flex gap-3">
                <input value={barcode} readOnly className="flex-1 rounded-lg border bg-gray-50 p-3" placeholder="Escaneie o produto" />

                <button
                  type="button"
                  onClick={() => {
                    setBarcode('');

                    clear();

                    clearBox();

                    setCreatedVariant(null);

                    setBoxCode(null);
                    setBoxLocked(false);

                    setExpirationDate(null);
                    setExpirationLocked(false);

                    setScannerOpen(true);
                  }}
                  disabled={loading}
                  className="rounded-lg bg-gray-900 px-4 text-white disabled:opacity-50"
                >
                  📷 Ler
                </button>
              </div>
            </div>

            {scannerOpen && (
              <div className="rounded-lg border p-4">
                <BarcodeScanner onDetected={handleBarcodeRead} />

                <button type="button" onClick={() => setScannerOpen(false)} className="mt-3 text-red-600">
                  Cancelar leitura
                </button>
              </div>
            )}
          </div>

          {/* ================================================== */}
          {/* LOADING                                             */}
          {/* ================================================== */}

          {loading && <div className="rounded-xl bg-white p-6 text-center shadow">Consultando produto...</div>}

          {/* ================================================== */}
          {/* PRODUTO NÃO ENCONTRADO                             */}
          {/* ================================================== */}

          {notFoundBarcode && !loading && (
            <div className="rounded-xl bg-white p-6 shadow">
              <p className="text-sm text-gray-500">Produto não encontrado</p>

              <h2 className="text-xl font-bold">Este código de barras ainda não está cadastrado.</h2>

              <p className="mt-2 font-mono">{notFoundBarcode}</p>

              <button type="button" onClick={handleRegisterProduct} className="mt-6 w-full rounded-lg bg-black px-6 py-3 text-white">
                Continuar cadastro
              </button>
            </div>
          )}
        </>
      )}

      {/* ====================================================== */}
      {/* ESCOLHA DO CADASTRO                                    */}
      {/* ====================================================== */}

      {step === 'product-choice' && notFoundBarcode && (
        <>
          <div>
            <h1 className="text-3xl font-bold">Produto não encontrado</h1>

            <p className="text-gray-500">O código de barras foi lido, mas nenhuma variante foi encontrada.</p>
          </div>

          <div className="space-y-6 rounded-xl bg-white p-6 shadow">
            <div>
              <p className="text-sm text-gray-500">Código de barras</p>

              <p className="font-mono text-lg font-bold">{notFoundBarcode}</p>
            </div>

            <div>
              <h2 className="text-xl font-bold">Esse produto já existe no cadastro?</h2>

              <p className="mt-2 text-gray-500">Se o produto já estiver cadastrado, vamos criar somente uma nova variante para ele.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Produto existente */}

              <button type="button" onClick={handleRegisterVariant} className="rounded-xl border p-6 text-left hover:bg-gray-50">
                <p className="text-lg font-bold">Sim, o produto existe</p>

                <p className="mt-2 text-sm text-gray-500">Pesquisar o produto e cadastrar somente a nova variante.</p>
              </button>

              {/* Produto novo */}

              <button type="button" onClick={() => setStep('register-product')} className="rounded-xl border p-6 text-left hover:bg-gray-50">
                <p className="text-lg font-bold">Não, é um produto novo</p>

                <p className="mt-2 text-sm text-gray-500">Cadastrar o produto e sua primeira variante.</p>
              </button>
            </div>

            <button type="button" onClick={handleBackToScan} className="rounded-lg border px-6 py-3">
              Voltar
            </button>
          </div>
        </>
      )}

      {/* ====================================================== */}
      {/* CADASTRO DE VARIANTE                                   */}
      {/* ====================================================== */}

      {step === 'register-variant' && notFoundBarcode && <ProductVariantRegistration barcode={notFoundBarcode} onCancel={() => setStep('product-choice')} onCreated={handleVariantCreated} />}

      {/* ====================================================== */}
      {/* CADASTRO DE PRODUTO NOVO                               */}
      {/* ====================================================== */}

      {step === 'register-product' && notFoundBarcode && (
        <>
          <div>
            <h1 className="text-3xl font-bold">Cadastrar produto</h1>

            <p className="text-gray-500">O produto escaneado ainda não está cadastrado.</p>
          </div>

          <div className="space-y-6 rounded-xl bg-white p-6 shadow">
            {/* Barcode */}

            <div>
              <label className="mb-1 block text-sm text-gray-500">Código de barras</label>

              <input value={notFoundBarcode} readOnly className="w-full rounded-lg border bg-gray-100 p-3 font-mono" />

              <p className="mt-2 text-sm text-gray-500">O código foi preenchido automaticamente pelo scanner.</p>
            </div>

            {/* Nome */}

            <div>
              <label className="mb-1 block">Nome do produto</label>

              <input type="text" placeholder="Ex.: Kaiak 100ml" className="w-full rounded-lg border p-3" />
            </div>

            {/* Ações */}

            <div className="flex justify-end gap-3">
              <button type="button" onClick={handleCancelProductRegistration} className="rounded-lg border px-6 py-3">
                Voltar
              </button>

              <button type="button" className="rounded-lg bg-black px-6 py-3 text-white">
                Cadastrar produto
              </button>
            </div>
          </div>
        </>
      )}

      {/* ====================================================== */}
      {/* REGISTRO DO LOTE                                      */}
      {/* ====================================================== */}

      {step === 'lot' && currentVariant && (
        <>
          <div>
            <h1 className="text-3xl font-bold">Registrar estoque</h1>

            <p className="text-gray-500">Informe o lote, validade, caixa e quantidade.</p>
          </div>

          {/* Produto / Variante */}

          <div className="rounded-xl bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Produto / Variante</p>

                <h2 className="text-xl font-bold">{currentVariant.name}</h2>
              </div>

              <span className="rounded-lg bg-gray-100 px-4 py-2 font-mono font-bold">{currentVariant.code}</span>
            </div>

            <div className="mt-4">
              <p className="text-sm text-gray-500">Código de barras</p>

              <p className="font-mono">{currentVariant.barcode ?? barcode}</p>
            </div>
          </div>

          {/* Formulário do lote */}

          <InventoryLotForm
            initialBoxCode={boxCode}
            initialExpirationDate={expirationDate}
            boxLocked={boxLocked}
            expirationLocked={expirationLocked}
            boxLoading={boxLoading}
            boxError={boxError}
            onBatchBlur={handleBatchBlur}
            onSubmit={handleLotSubmit}
            onCancel={handleBackToScan}
          />
        </>
      )}
    </div>
  );
}
