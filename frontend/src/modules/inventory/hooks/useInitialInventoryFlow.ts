import { useEffect, useState } from 'react';

import { useProductByBarcode } from './useProductByBarcode';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/shared/react-query/keys';
import { getInventoryLots } from '../services/inventoryService';
import { useInventoryLots } from './useInventoryLots';
import { useInventoryBoxByLot, type InventoryBox } from './useInventoryBoxByLot';
import { useInventoryBox } from './useInventoryBox';
import { useGenerateInventoryProductLabels } from './useGenerateInventoryProductLabels';

import type { InventoryLot, Product, ProductVariant } from '../types/InitialInventoryTypes';
import { useSearchProducts } from './useSearchProducts';
import { useCreateInventoryLot } from './useCreateInventoryLot';
import type { InventoryLotFormData } from '../components/InventoryLotForm';
import { getInventoryByVariant, createInventory } from '../services/inventoryService';

type FlowStep = 'start' | 'scan' | 'product-exists-choice' | 'product-search' | 'register-product' | 'register-variant' | 'lot' | 'box' | 'label-choice' | 'label-quantity';

type InventoryModalType = 'new-product' | 'product-selection' | 'new-lot' | 'label-quantity' | null;

type InventoryData = {
  id: string;
  productVariantId: string;
  quantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  minimumStock: number;
  createdAt: string;
};

type InventoryPrompt = 'create' | 'confirm-cancel' | null;

export function useInitialInventoryFlow() {
  const [step, setStep] = useState<FlowStep>('start');

  // Dentro de useInitialInventoryFlow():
  const [inventory, setInventory] = useState<InventoryData | null>(null);
  const [inventoryPrompt, setInventoryPrompt] = useState<InventoryPrompt>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryCreating, setInventoryCreating] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  const [modal, setModal] = useState<InventoryModalType>(null);

  function closeModal() {
    setModal(null);
  }
  function openModal(type: Exclude<InventoryModalType, null>) {
    setModal(type);
  }
  /**
   * Código de barras atualmente utilizado no fluxo.
   */
  const [barcode, setBarcode] = useState('');

  /**
   * Código de barras que não foi encontrado.
   */
  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);

  /**
   * Produto selecionado/encontrado.
   */
  const [product, setProduct] = useState<Product | null>(null);

  /**
   * Variante criada durante o fluxo.
   */
  const [createdVariant, setCreatedVariant] = useState<ProductVariant | null>(null);

  /**
   * Scanner.
   *
   * Importante:
   * entrar na etapa "scan" NÃO abre a câmera.
   * A câmera somente abre quando handleOpenScanner()
   * for chamado pelo componente.
   */
  const [scannerOpen, setScannerOpen] = useState(false);

  /**
   * Lote.
   */
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [lotConfirmed, setLotConfirmed] = useState(false);

  /**
   * Caixas disponíveis para o lote selecionado.
   */
  const [boxes, setBoxes] = useState<InventoryBox[]>([]);

  /**
   * Caixa escolhida pelo usuário.
   */
  const [selectedBox, setSelectedBox] = useState<InventoryBox | null>(null);

  /**
   * Dados da caixa atualmente utilizada.
   */
  const [boxId, setBoxId] = useState<string | null>(null);
  const [boxCode, setBoxCode] = useState('');

  /**
   * Quantidade adicionada ao estoque.
   *
   * Atualmente o fluxo adiciona 1 unidade por operação.
   */
  const [inventoryQuantity, setInventoryQuantity] = useState<number | null>(null);

  /**
   * Quantidade de etiquetas solicitadas.
   */
  const [labelQuantity, setLabelQuantity] = useState(1);

  /**
   * Hooks de domínio.
   */
  const { foundVariant, loading, searchByBarcode, clearFoundVariant } = useProductByBarcode();

  const queryClient = useQueryClient();
  const [lotsVariantId, setLotsVariantId] = useState<string | undefined>();
  const { lots, isLoading: lotsLoading, error: lotsQueryError } = useInventoryLots(lotsVariantId, { limit: 100 });
  const lotsError = lotsQueryError ? 'Não foi possível carregar os lotes.' : null;

  async function findLots(variantId: string) {
    setLotsVariantId(variantId);
    const result = await queryClient.fetchQuery({
      queryKey: [...queryKeys.inventoryLots(variantId), { page: 1, limit: 100 }],
      queryFn: () => getInventoryLots(variantId, { page: 1, limit: 100 }),
      staleTime: 0,
    });
    return result.data;
  }

  function clearLots() {
    setLotsVariantId(undefined);
  }

  const { findBoxByLot, loading: boxLookupLoading, error: boxLookupError, clearBox } = useInventoryBoxByLot();

  const { createBox, addLot, loading: boxMutationLoading, error: boxMutationError, clearError: clearBoxMutationError } = useInventoryBox();

  const { generate: generateProductLabels, loading: labelLoading, error: labelError, clearError: clearLabelError } = useGenerateInventoryProductLabels();

  const { products, loading: productsLoading, error: productsError, pagination: productsPagination, searchProducts, clearProducts } = useSearchProducts();

  const { create: createLot, loading: createLotLoading, error: createLotError } = useCreateInventoryLot();

  /**
   * A variante atual pode ser:
   *
   * - uma variante encontrada pelo código de barras;
   * - uma variante criada durante o fluxo.
   */
  const currentVariant = createdVariant ?? foundVariant;

  /**
   * Lote atualmente selecionado.
   */
  const selectedLot = lots.find((lot) => lot.id === selectedLotId) ?? null;

  async function validateInventoryForVariant(variant: ProductVariant) {
    setInventoryLoading(true);
    setInventoryError(null);
    setInventory(null);
    setInventoryPrompt(null);

    try {
      const result = await getInventoryByVariant(variant.id);

      if (result?.id) {
        setInventory(result);
        setInventoryPrompt(null);
        setStep('lot');
        return;
      }

      setInventoryPrompt('create');
    } catch {
      setInventoryError('Não foi possível consultar o inventory. Tente novamente.');
    } finally {
      setInventoryLoading(false);
    }
  }

  async function handleCreateInventory() {
    const variant = createdVariant ?? foundVariant;

    if (!variant || inventoryCreating) {
      return;
    }

    setInventoryCreating(true);
    setInventoryError(null);

    try {
      const created = await createInventory(variant.id);

      if (!created?.id) {
        setInventoryError('A API não retornou o inventory criado.');
        return;
      }

      setInventory(created);
      setInventoryPrompt(null);
      setStep('lot');
    } catch {
      setInventoryError('Não foi possível criar o inventory. Tente novamente.');
    } finally {
      setInventoryCreating(false);
    }
  }

  function handleDeclineInventoryCreation() {
    setInventoryPrompt('confirm-cancel');
  }

  function handleConfirmInventoryCancellation() {
    setInventoryPrompt(null);
    handleBackToStart();
  }

  function handleResumeInventoryCreation() {
    setInventoryPrompt('create');
  }

  /**
   * Carrega os lotes sempre que a variante atual mudar.
   */
  useEffect(() => {
    if (!currentVariant) {
      clearLots();
      return;
    }

    findLots(currentVariant.id);
  }, [currentVariant?.id]);

  /**
   * Quando uma variante é encontrada pelo código de barras,
   * avançamos automaticamente para a etapa de lote.
   */
  useEffect(() => {
    if (!foundVariant) {
      return;
    }

    setBarcode(foundVariant.barcode ?? '');
    setNotFoundBarcode(null);

    setSelectedLotId(null);
    setLotConfirmed(false);

    setBoxes([]);
    setSelectedBox(null);
    setBoxId(null);
    setBoxCode('');
    setInventoryQuantity(null);
    setLabelQuantity(1);

    void validateInventoryForVariant(foundVariant);
  }, [foundVariant]);

  /**
   * ============================================================
   * INÍCIO DO FLUXO
   * ============================================================
   */

  /**
   * Usuário escolheu:
   * "Ler código de barras".
   *
   * Aqui NÃO abrimos a câmera.
   * Apenas mostramos a tela com o botão da câmera.
   */
  function handleStartWithBarcode() {
    resetProductFlow();

    setStep('scan');
  }

  function handleProductSelected(product: ProductListItem) {
    setProduct(product);

    setStep('register-variant');
  }

  /**
   * Usuário escolheu:
   * "Cadastrar sem código de barras".
   *
   * O próximo passo é perguntar se o produto já existe.
   */
  function handleStartWithoutBarcode() {
    setBarcode('');
    setNotFoundBarcode(null);

    setProduct(null);
    setCreatedVariant(null);

    setSelectedLotId(null);
    setLotConfirmed(false);

    setBoxes([]);
    setSelectedBox(null);

    setBoxId(null);
    setBoxCode('');

    setInventoryQuantity(null);
    setLabelQuantity(1);

    closeModal();
    setScannerOpen(false);

    clearFoundVariant();
    clearLots();
    clearBox();
    clearBoxMutationError();
    clearLabelError();

    setStep('product-exists-choice');
  }

  /**
   * ============================================================
   * SCANNER
   * ============================================================
   */

  /**
   * Abre a câmera.
   *
   * Esta função deve ser chamada somente pelo botão
   * "Abrir câmera" do InitialInventoryScanner.
   */
  function handleOpenScanner() {
    setScannerOpen(true);
  }

  /**
   * Fecha a câmera.
   */
  function handleCloseScanner() {
    setScannerOpen(false);
  }

  /**
   * Resultado da leitura do código de barras.
   */
  async function handleBarcodeRead(scannedBarcode: string) {
    const normalizedBarcode = scannedBarcode.trim();

    if (!normalizedBarcode) {
      return;
    }

    setScannerOpen(false);

    setBarcode(normalizedBarcode);
    setNotFoundBarcode(null);

    resetLotAndBoxState();

    clearFoundVariant();
    clearLots();
    clearBox();
    clearBoxMutationError();
    clearLabelError();

    const variant = await searchByBarcode(normalizedBarcode);

    /**
     * Variante não encontrada.
     *
     * Nesse caso perguntamos se o produto existe.
     */
    if (!variant) {
      setNotFoundBarcode(normalizedBarcode);
      setStep('product-exists-choice');
      return;
    }

    // /**
    //  * Variante encontrada.
    //  *
    //  * O useEffect acima cuidará de avançar para "lot".
    //  */
    // setStep('lot');
  }

  /**
   * ============================================================
   * PRODUTO
   * ============================================================
   */

  /**
   * Produto já existe.
   *
   * Vai para a tela de pesquisa/seleção do produto.
   */
  function handleProductExists() {
    setStep('product-search');
  }

  /**
   * Compatibilidade com o componente atual,
   * caso ele ainda use esse nome.
   */
  function handleRegisterProduct() {
    // if (barcode) {
    //   setStep('product-exists-choice');
    //   return;
    // }

    setStep('product-exists-choice');
  }

  /**
   * Produto criado com sucesso.
   */
  function handleNewProductSuccess(createdProduct: Product) {
    setProduct(createdProduct);
    closeModal();

    setStep('register-variant');
  }

  /**
   * ============================================================
   * VARIANTE
   * ============================================================
   */

  /**
   * Usuário escolheu cadastrar uma variante
   * para um produto existente.
   */
  function handleRegisterVariant() {
    setStep('register-variant');
  }
  function handleSearchProduct() {
    setStep('product-search');
    openModal('product-selection');
  }

  /**
   * Variante criada.
   */
  async function handleVariantCreated(variant: ProductVariant) {
    setCreatedVariant(variant);

    setSelectedLotId(null);
    setLotConfirmed(false);

    setBoxes([]);
    setSelectedBox(null);

    setBoxId(null);
    setBoxCode('');

    setInventoryQuantity(null);
    setLabelQuantity(1);

    await validateInventoryForVariant(variant);
  }

  /**
   * ============================================================
   * LOTE
   * ============================================================
   */

  /**
   * Seleciona um lote.
   */
  function handleSelectLot(lotId: string) {
    if (lotConfirmed) {
      return;
    }

    const lot = lots.find((item) => item.id === lotId);

    if (!lot) {
      setSelectedLotId(null);
      return;
    }

    setSelectedLotId(lot.id);
    setLotConfirmed(false);
  }

  /**
   * Confirma o lote e busca as caixas relacionadas.
   */
  async function handleConfirmLot() {
    if (!currentVariant) {
      return;
    }

    if (!selectedLot) {
      return;
    }

    setBoxes([]);
    setSelectedBox(null);

    setBoxId(null);
    setBoxCode('');

    setInventoryQuantity(null);

    clearBox();
    clearBoxMutationError();

    setLotConfirmed(true);

    const batchNumber = selectedLot.batchNumber;

    /**
     * Se o lote não possui número,
     * ainda podemos continuar para caixa.
     */
    if (!batchNumber) {
      setStep('box');
      return;
    }

    const foundBoxes = await findBoxByLot(currentVariant.id, batchNumber);

    setBoxes(foundBoxes);
    setSelectedBox(null);

    setStep('box');
  }

  /**
   * ============================================================
   * NOVO LOTE
   * ============================================================
   */

  function handleOpenNewLotModal() {
    if (!currentVariant) {
      return;
    }

    if (selectedLot) {
      return;
    }

    openModal('new-lot');
  }

  /**
   * Novo lote criado.
   */
  async function handleNewLotSuccess(createdLot: InventoryLot) {
    if (!currentVariant) {
      return;
    }

    const result = await createLot({
      productVariantId: currentVariant.id,
      batchNumber: createdLot.batchNumber,
      manufacturingDate: createdLot.manufacturingDate || undefined,
      unitCost: createdLot.unitCost,
      expirationDate: new Date(createdLot.expirationDate).toUTCString(),
      quantity: createdLot.quantity,
    });

    if (!result) {
      return;
    }

    // Atualiza os dados do inventário após criar o lote.
    await validateInventoryForVariant(currentVariant);

    closeModal();

    const updatedLots = await findLots(currentVariant.id);

    const newLot = updatedLots.find((lot) => lot.id === result.id) ?? createdLot;

    setSelectedLotId(newLot.id);
    setLotConfirmed(true);

    setBoxes([]);
    setSelectedBox(null);

    setBoxId(null);
    setBoxCode('');

    setInventoryQuantity(null);
    setLabelQuantity(1);

    clearBox();
    clearBoxMutationError();

    if (newLot.batchNumber) {
      const foundBoxes = await findBoxByLot(currentVariant.id, newLot.batchNumber);

      setBoxes(foundBoxes);
    }

    setStep('box');
  }

  /**
   * ============================================================
   * CAIXA
   * ============================================================
   */

  /**
   * Cria somente uma nova caixa.
   *
   * A unidade ainda não é adicionada.
   */
  async function handleCreateBox(): Promise<boolean> {
    // async function handleCreateBox(code: string): Promise<boolean> {
    clearBoxMutationError();

    // const normalizedCode = code.trim();

    // if (!normalizedCode) {
    //   return false;
    // }

    const createdBox = await createBox();
    // const createdBox = await createBox({
    //   code: normalizedCode,
    // });

    if (!createdBox) {
      return false;
    }

    setBoxes((current) => [...current, createdBox]);

    setSelectedBox(createdBox);

    setBoxId(createdBox.id);
    setBoxCode(createdBox.code);

    return true;
  }

  /**
   * Seleciona uma caixa existente.
   */
  function handleSelectBox(box: InventoryBox) {
    setSelectedBox(box);

    setBoxId(box.id);
    setBoxCode(box.code);

    setInventoryQuantity(null);

    clearBoxMutationError();
  }

  /**
   * Adiciona uma unidade do lote
   * à caixa selecionada.
   */
  async function handleContinueWithBox() {
    if (!selectedLot) {
      return;
    }

    if (!selectedBox) {
      return;
    }

    clearBoxMutationError();

    const addedLot = await addLot(selectedBox.id, {
      inventoryLotId: selectedLot.id,
      quantity: 1,
    });

    if (!addedLot) {
      return;
    }

    setBoxId(selectedBox.id);
    setBoxCode(selectedBox.code);

    setInventoryQuantity(1);
    setLabelQuantity(1);

    /**
     * Unidade adicionada com sucesso.
     *
     * Agora perguntamos se deseja gerar etiqueta.
     */
    setStep('label-choice');
  }

  /**
   * ============================================================
   * ETIQUETAS
   * ============================================================
   */

  /**
   * Usuário deseja gerar etiquetas.
   */
  function handleGenerateLabel() {
    setLabelQuantity(1);
    clearLabelError();

    setStep('label-quantity');
  }

  /**
   * Usuário não deseja gerar etiqueta.
   */
  function handleSkipLabel() {
    handleFinishUnit();
  }

  /**
   * Altera quantidade de etiquetas.
   */
  function handleLabelQuantityChange(quantity: number) {
    if (!Number.isInteger(quantity)) {
      return;
    }

    if (quantity < 1) {
      return;
    }

    setLabelQuantity(quantity);
  }

  /**
   * Gera as etiquetas.
   */
  async function handleConfirmLabelQuantity() {
    if (!selectedBox) {
      return;
    }

    if (!currentVariant) {
      return;
    }

    if (labelQuantity < 1) {
      return;
    }

    clearLabelError();

    const result = await generateProductLabels(selectedBox.code, currentVariant.code, labelQuantity);

    if (!result) {
      return;
    }

    /**
     * Etiquetas geradas.
     *
     * Finaliza o cadastro da unidade.
     */
    handleFinishUnit();
  }

  /**
   * ============================================================
   * FINALIZAÇÃO
   * ============================================================
   */

  /**
   * Finaliza o cadastro da unidade atual
   * e prepara o fluxo para outro produto.
   */
  function handleFinishUnit() {
    resetProductFlow();

    setScannerOpen(false);

    /**
     * Voltamos para o início.
     *
     * O usuário poderá escolher:
     *
     * - Ler código de barras
     * - Cadastrar sem código de barras
     */
    setStep('start');
  }

  /**
   * ============================================================
   * NAVEGAÇÃO
   * ============================================================
   */

  /**
   * Volta para a tela inicial do fluxo.
   */
  function handleBackToStart() {
    setStep('start');

    setBarcode('');
    setNotFoundBarcode(null);

    setProduct(null);
    setCreatedVariant(null);

    setSelectedLotId(null);
    setLotConfirmed(false);

    setBoxes([]);
    setSelectedBox(null);

    setBoxId(null);
    setBoxCode('');

    setInventoryQuantity(null);
    setLabelQuantity(1);

    closeModal();
    closeModal();
    setScannerOpen(false);

    clearFoundVariant();
    clearLots();
    clearBox();
    clearBoxMutationError();
    clearLabelError();

    setInventory(null);
    setInventoryPrompt(null);
    setInventoryError(null);
  }

  /**
   * Volta para a tela de leitura.
   *
   * Mantido para compatibilidade com componentes
   * que ainda utilizam onBack.
   */
  function handleBackToScan() {
    resetProductFlow();

    setScannerOpen(false);
    setStep('scan');
  }

  /**
   * ============================================================
   * RESET
   * ============================================================
   */

  /**
   * Limpa estado relacionado ao produto atual.
   */
  function resetProductFlow() {
    setBarcode('');
    setNotFoundBarcode(null);

    setProduct(null);
    setCreatedVariant(null);

    resetLotAndBoxState();

    clearFoundVariant();
    clearLots();
    clearBox();
    clearBoxMutationError();
    clearLabelError();

    setInventory(null);
    setInventoryPrompt(null);
    setInventoryError(null);
  }

  /**
   * Limpa lote, caixa e etiquetas.
   */
  function resetLotAndBoxState() {
    setSelectedLotId(null);
    setLotConfirmed(false);

    setBoxes([]);
    setSelectedBox(null);

    setBoxId(null);
    setBoxCode('');

    setInventoryQuantity(null);
    setLabelQuantity(1);
  }

  /**
   * ============================================================
   * RETORNO
   * ============================================================
   */

  return {
    /**
     * Fluxo
     */
    step,
    setStep,

    /**
     * Produto / barcode
     */
    barcode,
    loading,

    product,
    currentVariant,
    createdVariant,

    notFoundBarcode,

    /**
     * Scanner
     */
    scannerOpen,

    handleStartWithBarcode,
    handleStartWithoutBarcode,

    handleBarcodeRead,
    handleOpenScanner,
    handleCloseScanner,

    /**
     * Produto
     */
    handleRegisterProduct,
    handleProductExists,

    handleRegisterVariant,

    handleNewProductSuccess,

    /**
     * Variante
     */
    handleVariantCreated,

    /**
     * Lotes
     */
    lots,
    lotsLoading,
    lotsError,

    selectedLotId,
    selectedLot,
    lotConfirmed,

    handleSelectLot,
    handleConfirmLot,

    handleOpenNewLotModal,
    handleNewLotSuccess,

    /**
     * Caixas
     */
    boxes,
    selectedBox,

    boxId,
    boxCode,

    inventoryQuantity,

    boxLoading: boxLookupLoading || boxMutationLoading,

    boxError: boxLookupError ?? boxMutationError,

    handleSelectBox,
    handleCreateBox,
    handleContinueWithBox,

    /**
     * Etiquetas
     */
    labelQuantity,
    labelLoading,
    labelError,

    handleGenerateLabel,
    handleSkipLabel,
    handleLabelQuantityChange,
    handleConfirmLabelQuantity,

    /**
     * Navegação
     */
    handleBackToStart,
    handleBackToScan,

    /**
     * Finalização
     */
    handleFinishUnit,

    products,
    productsLoading,
    productsError,
    productsPagination,
    searchProducts,
    clearProducts,
    handleSearchProduct,
    modal,
    openModal,
    closeModal,
    createLotLoading,
    createLotError,

    inventory,
    inventoryPrompt,
    inventoryLoading,
    inventoryCreating,
    inventoryError,

    validateInventoryForVariant,
    handleCreateInventory,
    handleDeclineInventoryCreation,
    handleConfirmInventoryCancellation,
    handleResumeInventoryCreation,
  };
}
