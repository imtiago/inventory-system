import { useState } from 'react';

import type { InventoryBox, InventoryLot, ProductVariant } from '../types';
import type { InventoryLotFormData } from '../components/InventoryLotForm';
import { apiErrorMessage } from '../utils/apiErrorMessage';
import { useProductByBarcode } from './useProductByBarcode';
import { useInventoryLots } from './useInventoryLots';
import { useInventoryBox } from './useInventoryBox';
import { useCreateInventoryLot } from './useCreateInventoryLot';
import { useGenerateInventoryProductLabels } from './useGenerateInventoryProductLabels';
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
  const [boxValidationError, setBoxValidationError] = useState<string | null>(null);

  const [placement, setPlacement] = useState<Placement | null>(null);

  const [labelQuantity, setLabelQuantity] = useState('1');
  const [labelValidationError, setLabelValidationError] = useState<string | null>(null);

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
    setBoxValidationError(null);
    boxMutations.clearError();
    lotCreation.clearError();
  }

  function resetAll() {
    setModal(null);
    setScannerOpen(false);
    setBarcode('');
    setProduct(null);
    setVariant(null);
    resetLotAndBox();
    setLabelQuantity('1');
    setLabelValidationError(null);
    labels.clearError();
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

    setScannerOpen(false);
    setBarcode(code);
    setVariant(null);
    resetLotAndBox();

    const result = await barcodeLookup.lookupBarcode(code);

    if (result.status === 'found') {
      chooseVariant(result.variant);
      return;
    }

    if (result.status === 'not-found') {
      setStep('product-exists-choice');
    }

    // status 'error': stay on 'scan'; the page shows barcodeError.
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
    setBoxValidationError(null);
  }

  function handleConfirmLot() {
    if (!selectedLot) return;

    boxMutations.clearError();
    setBoxValidationError(null);
    setStep('box');
  }

  function handleOpenNewLotModal() {
    if (!variant) return;

    lotCreation.clearError();
    setModal('new-lot');
  }

  async function handleNewLotSubmit(data: InventoryLotFormData) {
    if (!variant) return;

    const lot = await lotCreation.create({
      productVariantId: variant.id,
      batchNumber: data.batchNumber.trim(),
      quantity: data.quantity,
      unitCost: data.unitCost,
      expirationDate: data.expirationDate,
      manufacturingDate: data.manufacturingDate || undefined,
    });

    if (lot) {
      handleNewLotSuccess(lot);
    }
  }

  /** The lot returned by the API becomes the selected lot. */
  function handleNewLotSuccess(lot: InventoryLot) {
    setCreatedLot(lot);
    setSelectedLotId(lot.id);
    setSelectedBox(null);
    setBoxValidationError(null);
    boxMutations.clearError();
    setModal(null);
    setStep('box');
  }

  /* ---------------------------------------------------------------- caixa */

  function handleBackToLot() {
    setBoxValidationError(null);
    boxMutations.clearError();
    setStep('lot');
  }

  function handleSelectBox(box: InventoryBox) {
    setSelectedBox(box);
    setBoxValidationError(null);
    boxMutations.clearError();
  }

  async function handleCreateBox() {
    setBoxValidationError(null);

    const box = await boxMutations.createBox();

    if (box) {
      setSelectedBox(box);
    }
  }

  async function handleAddToBox(quantity: number) {
    if (!selectedLot || !selectedBox || !variant) return;

    const max = lotAvailableForBoxes;

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > max) {
      setBoxValidationError(max > 0 ? `Informe uma quantidade entre 1 e ${max}.` : 'Todo o saldo deste lote já está em caixas.');
      return;
    }

    setBoxValidationError(null);

    const item = await boxMutations.addLot(selectedBox.id, { inventoryLotId: selectedLot.id, quantity }, variant.id);

    if (!item) return;

    setPlacement({ quantity, boxCode: selectedBox.code });
    setLabelQuantity('1');
    setLabelValidationError(null);
    labels.clearError();
    setStep('label-choice');
  }

  /* ---------------------------------------------------------------- etiquetas */

  function handleGenerateLabel() {
    setLabelQuantity('1');
    setLabelValidationError(null);
    labels.clearError();
    setStep('label-quantity');
  }

  function handleBackToLabelChoice() {
    setLabelValidationError(null);
    labels.clearError();
    setStep('label-choice');
  }

  function handleLabelQuantityChange(value: string) {
    setLabelQuantity(value);
    setLabelValidationError(null);
  }

  async function handleConfirmLabelQuantity() {
    if (!selectedBox || !variant) return;

    const quantity = Number(labelQuantity);

    if (labelQuantity.trim() === '' || !Number.isInteger(quantity) || quantity < 1) {
      setLabelValidationError('Informe uma quantidade de etiquetas válida (mínimo 1).');
      return;
    }

    const generated = await labels.generate(selectedBox.code, variant.code, quantity);

    if (generated) {
      handleFinishUnit();
    }
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
    barcodeError: barcodeLookup.error,
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
    createLotError: lotCreation.error,

    selectedBox,
    boxLoading: boxMutations.loading,
    boxError: boxValidationError ?? boxMutations.error,

    placementMessage: placement ? placementMessage(placement) : null,

    labelQuantity,
    labelLoading: labels.loading,
    labelError: labelValidationError ?? labels.error,

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
