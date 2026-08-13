import { useEffect, useState } from "react";

import { BarcodeScanner } from "@/components/BarcodeScanner";

import { useProductByBarcode } from "../hooks/useProductByBarcode";
import { useInventoryBoxByLot } from "../hooks/useInventoryBoxByLot";

import {
  InventoryLotForm,
  type InventoryLotFormData,
} from "../components/InventoryLotForm";

export function InitialInventoryPage() {
  const [scannerOpen, setScannerOpen] = useState(false);

  const [barcode, setBarcode] = useState("");

  const [step, setStep] = useState<"scan" | "register-product" | "lot">("scan");

  const [boxCode, setBoxCode] = useState<string | null>(null);

  const [boxLocked, setBoxLocked] = useState(false);

  const [expirationDate, setExpirationDate] = useState<string | null>(null);

  const [expirationLocked, setExpirationLocked] = useState(false);

  const { product, notFoundBarcode, loading, findByBarcode, clear } =
    useProductByBarcode();

  const {
    loading: boxLoading,
    error: boxError,
    findBoxByLot,
    clearBox,
  } = useInventoryBoxByLot();

  /*
   * Quando o produto for encontrado,
   * abre automaticamente o formulário de lote.
   */
  useEffect(() => {
    if (step === "scan" && !loading && product) {
      setStep("lot");
    }
  }, [product, loading, step]);

  /*
   * Barcode encontrado pelo scanner.
   */
  function handleBarcodeRead(code: string) {
    setBarcode(code);

    setScannerOpen(false);

    setBoxCode(null);
    setBoxLocked(false);

    setExpirationDate(null);
    setExpirationLocked(false);

    clearBox();

    findByBarcode(code);
  }

  /*
   * Produto não encontrado.
   *
   * Abre a tela de cadastro do produto.
   */
  function handleRegisterProduct() {
    if (!notFoundBarcode) {
      return;
    }

    setStep("register-product");
  }

  /*
   * Saiu do campo lote.
   */
  async function handleBatchBlur(batchNumber: string) {
    if (!product) {
      return;
    }

    const normalizedBatch = batchNumber.trim();

    if (!normalizedBatch) {
      return;
    }

    setBoxCode(null);
    setBoxLocked(false);

    setExpirationDate(null);
    setExpirationLocked(false);

    clearBox();

    const foundBox = await findBoxByLot(product.id, normalizedBatch);

    /*
     * Lote não encontrado.
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
     * Procura o estoque referente ao lote informado.
     */
    const stock = foundBox.stocks.find(
      (item) =>
        item.productVariant.id === product.id &&
        item.inventoryLot.batchNumber === normalizedBatch,
    );

    if (!stock || !stock.inventoryLot.expirationDate) {
      setExpirationDate(null);
      setExpirationLocked(false);

      return;
    }

    const formattedDate = new Date(stock.inventoryLot.expirationDate)
      .toISOString()
      .split("T")[0];

    setExpirationDate(formattedDate);
    setExpirationLocked(true);
  }

  /*
   * Registro do estoque.
   */
  function handleLotSubmit(data: InventoryLotFormData) {
    if (!product) {
      return;
    }

    console.log("Produto:", product);
    console.log("Dados do lote:", data);

    /*
     * Próximo passo:
     *
     * chamar API de inventário inicial.
     */
  }

  /*
   * Voltar para o scanner.
   */
  function handleBackToScan() {
    setStep("scan");

    setBarcode("");

    setBoxCode(null);
    setBoxLocked(false);

    setExpirationDate(null);
    setExpirationLocked(false);

    setScannerOpen(false);

    clearBox();

    clear();
  }

  /*
   * Cancelar cadastro do produto.
   *
   * Neste momento simplesmente
   * voltamos para o scanner.
   */
  function handleCancelProductRegistration() {
    handleBackToScan();
  }

  return (
    <div className="space-y-6">
      {/* ====================================== */}
      {/* SCANNER                               */}
      {/* ====================================== */}

      {step === "scan" && (
        <>
          <div>
            <h1 className="text-3xl font-bold">Inventário Inicial</h1>

            <p className="text-gray-500">
              Escaneie os produtos para realizar a contagem inicial do estoque.
            </p>
          </div>

          <div
            className="
              bg-white
              rounded-xl
              shadow
              p-6
              space-y-5
            "
          >
            <div>
              <label className="block mb-1">Código de barras</label>

              <div className="flex gap-3">
                <input
                  value={barcode}
                  readOnly
                  className="
                    flex-1
                    border
                    rounded-lg
                    p-3
                    bg-gray-50
                  "
                  placeholder="Escaneie o produto"
                />

                <button
                  type="button"
                  onClick={() => {
                    setBarcode("");

                    clear();

                    clearBox();

                    setBoxCode(null);
                    setBoxLocked(false);

                    setExpirationDate(null);
                    setExpirationLocked(false);

                    setScannerOpen(true);
                  }}
                  disabled={loading}
                  className="
                    bg-gray-900
                    text-white
                    px-4
                    rounded-lg
                    disabled:opacity-50
                  "
                >
                  📷 Ler
                </button>
              </div>
            </div>

            {scannerOpen && (
              <div
                className="
                  border
                  rounded-lg
                  p-4
                "
              >
                <BarcodeScanner onDetected={handleBarcodeRead} />

                <button
                  type="button"
                  onClick={() => setScannerOpen(false)}
                  className="
                    mt-3
                    text-red-600
                  "
                >
                  Cancelar leitura
                </button>
              </div>
            )}
          </div>

          {loading && (
            <div
              className="
                bg-white
                rounded-xl
                shadow
                p-6
                text-center
              "
            >
              Consultando produto...
            </div>
          )}

          {/* ====================================== */}
          {/* PRODUTO NÃO ENCONTRADO                 */}
          {/* ====================================== */}

          {notFoundBarcode && !loading && (
            <div
              className="
                bg-white
                rounded-xl
                shadow
                p-6
              "
            >
              <p className="text-sm text-gray-500">Produto não encontrado</p>

              <h2 className="text-xl font-bold">
                Este produto ainda não está cadastrado.
              </h2>

              <p className="mt-2 font-mono">{notFoundBarcode}</p>

              <button
                type="button"
                onClick={handleRegisterProduct}
                className="
                  mt-6
                  w-full
                  bg-black
                  text-white
                  rounded-lg
                  px-6
                  py-3
                "
              >
                Cadastrar produto
              </button>
            </div>
          )}
        </>
      )}

      {/* ====================================== */}
      {/* CADASTRO DO PRODUTO                    */}
      {/* ====================================== */}

      {step === "register-product" && notFoundBarcode && (
        <>
          <div>
            <h1 className="text-3xl font-bold">Cadastrar produto</h1>

            <p className="text-gray-500">
              O produto escaneado ainda não está cadastrado.
            </p>
          </div>

          <div
            className="
              bg-white
              rounded-xl
              shadow
              p-6
              space-y-6
            "
          >
            {/* Código de barras */}

            <div>
              <label className="block mb-1 text-sm text-gray-500">
                Código de barras
              </label>

              <input
                value={notFoundBarcode}
                readOnly
                className="
                  w-full
                  border
                  rounded-lg
                  p-3
                  bg-gray-100
                  font-mono
                "
              />

              <p className="mt-2 text-sm text-gray-500">
                O código foi preenchido automaticamente pelo scanner.
              </p>
            </div>

            {/* Nome */}

            <div>
              <label className="block mb-1">Nome do produto</label>

              <input
                type="text"
                placeholder="Ex.: Kaiak 100ml"
                className="
                  w-full
                  border
                  rounded-lg
                  p-3
                "
              />
            </div>

            {/* Ações */}

            <div
              className="
                flex
                justify-end
                gap-3
              "
            >
              <button
                type="button"
                onClick={handleCancelProductRegistration}
                className="
                  border
                  px-6
                  py-3
                  rounded-lg
                "
              >
                Voltar
              </button>

              <button
                type="button"
                className="
                  bg-black
                  text-white
                  px-6
                  py-3
                  rounded-lg
                "
              >
                Cadastrar produto
              </button>
            </div>
          </div>
        </>
      )}

      {/* ====================================== */}
      {/* LOTE                                   */}
      {/* ====================================== */}

      {step === "lot" && product && (
        <>
          <div>
            <h1 className="text-3xl font-bold">Registrar estoque</h1>

            <p className="text-gray-500">
              Informe o lote, validade, caixa e quantidade.
            </p>
          </div>

          <div
            className="
              bg-white
              rounded-xl
              shadow
              p-6
            "
          >
            <div
              className="
                flex
                items-center
                justify-between
              "
            >
              <div>
                <p className="text-sm text-gray-500">Produto</p>

                <h2 className="text-xl font-bold">{product.name}</h2>
              </div>

              <span
                className="
                  bg-gray-100
                  px-4
                  py-2
                  rounded-lg
                  font-mono
                  font-bold
                "
              >
                {product.code}
              </span>
            </div>

            <div className="mt-4">
              <p className="text-sm text-gray-500">Código de barras</p>

              <p className="font-mono">{product.barcode}</p>
            </div>
          </div>

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
