import { useRef, useState } from 'react';

import type { InventoryBox, InventoryLot, ProductVariant } from '../types';
import type { InventoryLotFormData } from '../components/InventoryLotForm';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import { useProductByBarcode } from './useProductByBarcode';
import { useInventoryLots } from './useInventoryLots';
import { useInventoryBox } from './useInventoryBox';
import { useCreateInventoryLot } from './useCreateInventoryLot';
import { downloadPdf, useGenerateInventoryProductLabels } from './useGenerateInventoryProductLabels';
import { useSearchProducts } from './useSearchProducts';

export type FlowStep = 'start' | 'scan' | 'product-exists-choice' | 'product-search' | 'register-product' | 'register-variant' | 'lot' | 'box' | 'label-choice' | 'label-quantity';

export type InventoryModalType = 'new-product' | 'product-selection' | 'new-lot' | null;

/** Minimal product data the wizard needs (search result or newly created product). */
export interface WizardProduct {
  id: string;
  name: string;
}

interface Placement {
  quantity: number;
  boxCode: string;
}

/** Units of a lot that can still go into boxes. Sales may push allocated above remaining (known, deferred): never negative. */
export function availableForBoxes(lot: Pick<InventoryLot, 'remainingQuantity' | 'allocatedQuantity'> | null): number {
  if (!lot) return 0;

  return Math.max(0, lot.remainingQuantity - lot.allocatedQuantity);
}

export function placementMessage({ quantity, boxCode }: Placement): string {
  return `${quantity} unidade(s) colocada(s) na caixa ${boxCode}.`;
}

export function useInitialInventoryFlow() {
  const [step, setStep] = useState<FlowStep>('start');
  const [stepBeforeSearch, setStepBeforeSearch] = useState<FlowStep>('product-exists-choice');
  const [modal, setModal] = useState<InventoryModalType>(null);

  const [barcode, setBarcode] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  const [product, setProduct] = useState<WizardProduct | null>(null);
  const [variant, setVariant] = useState<ProductVariant | null>(null);

  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  /** Lot returned by the API on creation, used until the lots query refetches. */
  const [createdLot, setCreatedLot] = useState<InventoryLot | null>(null);

  const [selectedBox, setSelectedBox] = useState<InventoryBox | null>(null);
  const [boxError, setBoxError] = useState<string | null>(null);

  const [placement, setPlacement] = useState<Placement | null>(null);

  const [labelQuantity, setLabelQuantity] = useState('1');
  const [labelError, setLabelError] = useState<string | null>(null);
  const [lotError, setLotError] = useState<string | null>(null);

  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  /**
   * Latest-wins token for async work that moves the wizard or sets its state
   * (barcode lookup, lot creation, box creation, add to box, labels).
   * Navigation and every new request bump it; a result (success or error) whose token is no longer current is ignored.
   */
  const requestToken = useRef(0);

  function nextToken() {
    requestToken.current += 1;

    return requestToken.current;
  }

  function isCurrent(token: number) {
    return token === requestToken.current;
  }

  const barcodeLookup = useProductByBarcode();
  const { lots, isLoading: lotsLoading, error: lotsQueryError } = useInventoryLots(variant?.id, { limit: 100 });
  const boxMutations = useInventoryBox();
  const lotCreation = useCreateInventoryLot();
  const labels = useGenerateInventoryProductLabels();
  const productSearch = useSearchProducts();

  const lotsError = lotsQueryError ? apiErrorMessage(lotsQueryError, 'Não foi possível carregar os lotes.') : null;

  const selectedLot = lots.find((lot) => lot.id === selectedLotId) ?? (createdLot?.id === selectedLotId ? createdLot : null);
  const lotAvailableForBoxes = availableForBoxes(selectedLot);

  function resetLotAndBox() {
    setSelectedLotId(null);
    setCreatedLot(null);
    setSelectedBox(null);
    setBoxError(null);
    setLotError(null);
  }

  function resetAll() {
    nextToken();
    setBarcodeError(null);
    setModal(null);
    setScannerOpen(false);
    setBarcode('');
    setProduct(null);
    setVariant(null);
    resetLotAndBox();
    setLabelQuantity('1');
    setLabelError(null);
    barcodeLookup.clearFoundVariant();
    productSearch.clearProducts();
  }

  /* ---------------------------------------------------------------- início */

  function handleStartWithBarcode() {
    resetAll();
    setPlacement(null);
    setStep('scan');
  }

  function handleStartWithoutBarcode() {
    resetAll();
    setPlacement(null);
    setStep('product-exists-choice');
  }

  function handleBackToStart() {
    resetAll();
    setStep('start');
  }

  /* ---------------------------------------------------------------- leitura */

  function handleOpenScanner() {
    setScannerOpen(true);
  }

  function handleCloseScanner() {
    setScannerOpen(false);
  }

  async function handleBarcodeRead(scanned: string) {
    const code = scanned.trim();

    if (!code) return;

    const token = nextToken();

    setScannerOpen(false);
    setBarcode(code);
    setBarcodeError(null);
    setVariant(null);
    resetLotAndBox();

    const result = await barcodeLookup.lookupBarcode(code);

    // A newer scan, "Voltar" or a restart happened meanwhile: this result is stale.
    if (!isCurrent(token)) return;

    if (result.status === 'error') {
      setBarcodeError(result.message);
      return;
    }

    if (result.status === 'found') {
      chooseVariant(result.variant);
      return;
    }

    setStep('product-exists-choice');
  }

  /* ---------------------------------------------------------------- produto */

  function handleProductExists() {
    setStepBeforeSearch(step === 'product-search' ? stepBeforeSearch : step);
    setStep('product-search');
    setModal('product-selection');
  }

  function handleOpenNewProduct() {
    setModal('new-product');
  }

  function goToVariantStep(selected: WizardProduct) {
    setProduct({ id: selected.id, name: selected.name });
    setModal(null);
    setStep('register-variant');
  }

  function handleProductSelected(selected: WizardProduct) {
    goToVariantStep(selected);
  }

  function handleNewProductSuccess(created: WizardProduct) {
    goToVariantStep(created);
  }

  /** Closing a modal never leaves the wizard on an empty step. */
  function closeModal() {
    // A lot being created can't be abandoned: its result selects the lot and moves the wizard on.
    if (lotCreation.loading) return;

    nextToken();

    if (modal === 'product-selection' && step === 'product-search') {
      setStep(stepBeforeSearch);
    }

    setModal(null);
  }

  /* ---------------------------------------------------------------- variante */

  function chooseVariant(chosen: ProductVariant) {
    setVariant(chosen);
    resetLotAndBox();
    setStep('lot');
  }

  function handleVariantChosen(chosen: ProductVariant) {
    chooseVariant(chosen);
  }

  function handleBackFromVariant() {
    setProduct(null);
    setStep('product-exists-choice');
  }

  /* ---------------------------------------------------------------- lote */

  function handleSelectLot(lotId: string) {
    setSelectedLotId(lotId || null);
    setSelectedBox(null);
    setBoxError(null);
  }

  function handleConfirmLot() {
    if (!selectedLot) return;

    setBoxError(null);
    setStep('box');
  }

  function handleOpenNewLotModal() {
    if (!variant) return;

    setLotError(null);
    setModal('new-lot');
  }

  async function handleNewLotSubmit(data: InventoryLotFormData): Promise<{ fieldErrors?: Record<string, string> } | void> {
    if (!variant) return;

    const token = nextToken();

    setLotError(null);

    const result = await lotCreation.tryCreate({
      productVariantId: variant.id,
      batchNumber: data.batchNumber.trim(),
      quantity: data.quantity,
      unitCost: data.unitCost,
      expirationDate: data.expirationDate,
      manufacturingDate: data.manufacturingDate || undefined,
    });

    if (!isCurrent(token)) return;

    if (!result.ok) {
      // Field errors are shown inline by the form; the generic banner would repeat them.
      const hasFieldErrors = Object.keys(result.fieldErrors ?? {}).length > 0;

      setLotError(hasFieldErrors ? null : result.error);
      return { fieldErrors: result.fieldErrors };
    }

    handleNewLotSuccess(result.data);
  }

  /** The lot returned by the API becomes the selected lot. */
  function handleNewLotSuccess(lot: InventoryLot) {
    setCreatedLot(lot);
    setSelectedLotId(lot.id);
    setSelectedBox(null);
    setBoxError(null);
    setModal(null);
    setStep('box');
  }

  /* ---------------------------------------------------------------- caixa */

  function handleBackToLot() {
    // The add-to-box request is already on its way: wait for its result instead of discarding it.
    if (boxMutations.loading) return;

    nextToken();
    setBoxError(null);
    setStep('lot');
  }

  function handleSelectBox(box: InventoryBox) {
    if (boxMutations.loading) return;

    nextToken();
    setSelectedBox(box);
    setBoxError(null);
  }

  async function handleCreateBox() {
    const token = nextToken();

    setBoxError(null);

    const result = await boxMutations.createBox();

    if (!isCurrent(token)) return;

    if (!result.ok) {
      setBoxError(result.error);
      return;
    }

    setSelectedBox(result.data);
  }

  async function handleAddToBox(quantity: number) {
    if (!selectedLot || !selectedBox || !variant) return;

    const max = lotAvailableForBoxes;

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > max) {
      setBoxError(max > 0 ? `Informe uma quantidade entre 1 e ${max}.` : 'Todo o saldo deste lote já está em caixas.');
      return;
    }

    const token = nextToken();

    setBoxError(null);

    const result = await boxMutations.addLot(selectedBox.id, { inventoryLotId: selectedLot.id, quantity }, variant.id);

    // "Voltar" (or any reset) while the request was pending: don't move the wizard.
    if (!isCurrent(token)) return;

    if (!result.ok) {
      setBoxError(result.error);
      return;
    }

    setPlacement({ quantity, boxCode: selectedBox.code });
    setLabelQuantity('1');
    setLabelError(null);
    setStep('label-choice');
  }

  /* ---------------------------------------------------------------- etiquetas */

  function handleGenerateLabel() {
    setLabelQuantity('1');
    setLabelError(null);
    setStep('label-quantity');
  }

  function handleBackToLabelChoice() {
    nextToken();
    setLabelError(null);
    setStep('label-choice');
  }

  function handleLabelQuantityChange(value: string) {
    setLabelQuantity(value);
    setLabelError(null);
  }

  async function handleConfirmLabelQuantity() {
    if (!selectedBox || !variant) return;

    const quantity = Number(labelQuantity);

    if (labelQuantity.trim() === '' || !Number.isInteger(quantity) || quantity < 1) {
      setLabelError('Informe uma quantidade de etiquetas válida (mínimo 1).');
      return;
    }

    const token = nextToken();

    setLabelError(null);

    const result = await labels.generate(selectedBox.code, variant.code, quantity);

    if (!isCurrent(token)) return;

    if (!result.ok) {
      setLabelError(result.error);
      return;
    }

    try {
      downloadPdf(result.data, `etiquetas-${selectedBox.code}.pdf`);
    } catch {
      setLabelError('Não foi possível entregar o PDF das etiquetas. Tente gerar novamente.');
      return;
    }

    handleFinishUnit();
  }

  function handleSkipLabel() {
    handleFinishUnit();
  }

  /** Back to the start; the last placement message stays visible there. */
  function handleFinishUnit() {
    resetAll();
    setStep('start');
  }

  return {
    step,
    modal,
    closeModal,

    barcode,
    barcodeLoading: barcodeLookup.loading,
    barcodeError,
    scannerOpen,

    product,
    variant,

    productSearch,

    lots,
    lotsLoading,
    lotsError,
    selectedLotId,
    selectedLot,
    lotAvailableForBoxes,
    createLotLoading: lotCreation.loading,
    modalLocked: lotCreation.loading,
    createLotError: lotError,

    selectedBox,
    boxLoading: boxMutations.loading,
    boxError,

    placementMessage: placement ? placementMessage(placement) : null,

    labelQuantity,
    labelLoading: labels.loading,
    labelError,

    handleStartWithBarcode,
    handleStartWithoutBarcode,
    handleBackToStart,

    handleOpenScanner,
    handleCloseScanner,
    handleBarcodeRead,

    handleProductExists,
    handleOpenNewProduct,
    handleProductSelected,
    handleNewProductSuccess,

    handleVariantChosen,
    handleBackFromVariant,

    handleSelectLot,
    handleConfirmLot,
    handleOpenNewLotModal,
    handleNewLotSubmit,
    handleNewLotSuccess,

    handleBackToLot,
    handleSelectBox,
    handleCreateBox,
    handleAddToBox,

    handleGenerateLabel,
    handleBackToLabelChoice,
    handleLabelQuantityChange,
    handleConfirmLabelQuantity,
    handleSkipLabel,
    handleFinishUnit,
  };
}
