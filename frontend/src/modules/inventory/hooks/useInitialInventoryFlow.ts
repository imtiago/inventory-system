import { useEffect, useState } from 'react';

import { useProductByBarcode } from './useProductByBarcode';
import { useInventoryLotsByVariant } from './useInventoryLotsByVariant';
import { useInventoryBoxByLot, type InventoryBox } from './useInventoryBoxByLot';
import { useInventoryBox } from './useInventoryBox';
import { useGenerateProductLabels } from './useGenerateProductLabels';

import type { InventoryLot, Product, ProductVariant } from '../types/InitialInventoryTypes';

type FlowStep = 'scan' | 'product-choice' | 'register-variant' | 'lot' | 'box' | 'label-choice' | 'label-quantity';

export function useInitialInventoryFlow() {
  const [step, setStep] = useState<FlowStep>('scan');

  const [barcode, setBarcode] = useState('');

  const [notFoundBarcode, setNotFoundBarcode] = useState<string | null>(null);

  const [product, setProduct] = useState<Product | null>(null);

  const [createdVariant, setCreatedVariant] = useState<ProductVariant | null>(null);

  const [newProductModalOpen, setNewProductModalOpen] = useState(false);

  const [newLotModalOpen, setNewLotModalOpen] = useState(false);

  const [scannerOpen, setScannerOpen] = useState(false);

  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);

  const [lotConfirmed, setLotConfirmed] = useState(false);

  /**
   * Caixas encontradas para o lote atual.
   */
  const [boxes, setBoxes] = useState<InventoryBox[]>([]);

  /**
   * Caixa selecionada pelo usuário.
   */
  const [selectedBox, setSelectedBox] = useState<InventoryBox | null>(null);

  /**
   * Caixa utilizada para a unidade atual.
   */
  const [boxId, setBoxId] = useState<string | null>(null);

  const [boxCode, setBoxCode] = useState('');

  const [inventoryQuantity, setInventoryQuantity] = useState<number | null>(null);

  /**
   * Quantidade de etiquetas que o usuário deseja gerar.
   */
  const [labelQuantity, setLabelQuantity] = useState(1);

  const { foundVariant, loading, searchByBarcode, clearFoundVariant } = useProductByBarcode();

  const { lots, loading: lotsLoading, error: lotsError, findLots, clearLots } = useInventoryLotsByVariant();

  const { findBoxByLot, loading: boxLookupLoading, error: boxLookupError, clearBox } = useInventoryBoxByLot();

  const { createBox, addLot, loading: boxMutationLoading, error: boxMutationError, clearError: clearBoxMutationError } = useInventoryBox();

  const { generateProductLabels, loading: labelLoading, error: labelError } = useGenerateProductLabels();

  const currentVariant = createdVariant ?? foundVariant;

  const selectedLot = lots.find((lot) => lot.id === selectedLotId) ?? null;

  /*
   * Carrega os lotes quando a variante muda.
   */
  useEffect(() => {
    if (!currentVariant) {
      clearLots();
      return;
    }

    findLots(currentVariant.id);
  }, [currentVariant?.id]);

  /*
   * Quando encontra uma variante pelo código de barras,
   * vai para a etapa de lote.
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

    setStep('lot');
  }, [foundVariant]);

  async function handleBarcodeRead(scannedBarcode: string) {
    const normalizedBarcode = scannedBarcode.trim();

    if (!normalizedBarcode) {
      return;
    }

    setBarcode(normalizedBarcode);
    setNotFoundBarcode(null);

    setSelectedLotId(null);
    setLotConfirmed(false);

    setBoxes([]);
    setSelectedBox(null);

    setBoxId(null);
    setBoxCode('');

    setInventoryQuantity(null);
    setLabelQuantity(1);

    clearFoundVariant();
    clearLots();
    clearBox();
    clearBoxMutationError();

    const variant = await searchByBarcode(normalizedBarcode);

    if (!variant) {
      setNotFoundBarcode(normalizedBarcode);
      setStep('product-choice');
      return;
    }

    setStep('lot');
  }

  function handleOpenScanner() {
    setScannerOpen(true);
  }

  function handleCloseScanner() {
    setScannerOpen(false);
  }

  function handleRegisterProduct() {
    if (!notFoundBarcode) {
      return;
    }

    setStep('product-choice');
  }

  function handleOpenNewProductModal() {
    setNewProductModalOpen(true);
  }

  function handleCloseNewProductModal() {
    setNewProductModalOpen(false);
  }

  function handleNewProductSuccess(createdProduct: Product) {
    setProduct(createdProduct);

    setNewProductModalOpen(false);

    setStep('register-variant');
  }

  function handleRegisterVariant() {
    setStep('register-variant');
  }

  function handleVariantCreated(variant: ProductVariant) {
    setCreatedVariant(variant);

    setSelectedLotId(null);
    setLotConfirmed(false);

    setBoxes([]);
    setSelectedBox(null);

    setBoxId(null);
    setBoxCode('');

    setInventoryQuantity(null);
    setLabelQuantity(1);

    setStep('lot');
  }

  function handleBackToScan() {
    setStep('scan');

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

    clearFoundVariant();
    clearLots();
    clearBox();
    clearBoxMutationError();
  }

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

    if (!batchNumber) {
      setStep('box');
      return;
    }

    const foundBoxes = await findBoxByLot(currentVariant.id, batchNumber);

    setBoxes(foundBoxes);
    setSelectedBox(null);

    setStep('box');
  }

  function handleOpenNewLotModal() {
    if (!currentVariant) {
      return;
    }

    if (selectedLot) {
      return;
    }

    setNewLotModalOpen(true);
  }

  function handleCloseNewLotModal() {
    setNewLotModalOpen(false);
  }

  async function handleNewLotSuccess(createdLot: InventoryLot) {
    if (!currentVariant) {
      return;
    }

    setNewLotModalOpen(false);

    const updatedLots = await findLots(currentVariant.id);

    const newLot = updatedLots.find((lot) => lot.id === createdLot.id) ?? createdLot;

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
   * Cria somente a caixa.
   *
   * A unidade ainda NÃO é adicionada ao estoque.
   */
  async function handleCreateBox(code: string): Promise<boolean> {
    clearBoxMutationError();

    const normalizedCode = code.trim();

    if (!normalizedCode) {
      return false;
    }

    const createdBox = await createBox({
      code: normalizedCode,
    });

    if (!createdBox) {
      return false;
    }

    setBoxes((current) => [...current, createdBox]);

    setSelectedBox(createdBox);

    setBoxId(createdBox.id);
    setBoxCode(createdBox.code);

    return true;
  }

  function handleSelectBox(box: InventoryBox) {
    setSelectedBox(box);

    setBoxId(box.id);
    setBoxCode(box.code);

    setInventoryQuantity(null);

    clearBoxMutationError();
  }

  /**
   * Adiciona exatamente 1 unidade
   * do lote selecionado à caixa selecionada.
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

    /*
     * A unidade foi adicionada.
     *
     * Agora perguntamos se o usuário
     * deseja gerar etiqueta.
     */
    setStep('label-choice');
  }

  /**
   * Usuário escolheu gerar etiqueta.
   */
  function handleGenerateLabel() {
    setLabelQuantity(1);
    setStep('label-quantity');
  }

  /**
   * Usuário não quer gerar etiqueta.
   */
  function handleSkipLabel() {
    handleFinishUnit();
  }

  /**
   * Altera a quantidade de etiquetas.
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
   * Envia a solicitação de geração das etiquetas.
   *
   * Exemplo:
   *
   * {
   *   productCode: "V000002",
   *   quantity: 5
   * }
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

    const result = await generateProductLabels({
      boxCode: selectedBox.code,
      productCode: currentVariant.code,
      quantity: labelQuantity,
    });

    if (!result) {
      return;
    }

    /*
     * Depois de gerar as etiquetas,
     * encerramos a unidade atual
     * e voltamos para o scanner.
     */
    handleFinishUnit();
  }

  /**
   * Finaliza o cadastro da unidade atual
   * e prepara o fluxo para o próximo produto.
   */
  function handleFinishUnit() {
    setStep('scan');

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

    clearFoundVariant();
    clearLots();
    clearBox();
    clearBoxMutationError();
  }

  return {
    step,

    barcode,
    loading,

    scannerOpen,

    product,
    currentVariant,
    createdVariant,

    notFoundBarcode,

    newProductModalOpen,
    newLotModalOpen,

    lots,
    lotsLoading,
    lotsError,

    selectedLotId,
    selectedLot,
    lotConfirmed,

    boxes,
    selectedBox,

    boxId,
    boxCode,

    inventoryQuantity,

    labelQuantity,
    labelLoading,
    labelError,

    boxLoading: boxLookupLoading || boxMutationLoading,

    boxError: boxLookupError ?? boxMutationError,

    handleBarcodeRead,
    handleOpenScanner,
    handleCloseScanner,

    handleRegisterProduct,
    handleRegisterVariant,

    handleOpenNewProductModal,
    handleCloseNewProductModal,
    handleNewProductSuccess,

    handleVariantCreated,

    handleBackToScan,

    handleSelectLot,
    handleConfirmLot,

    handleOpenNewLotModal,
    handleCloseNewLotModal,
    handleNewLotSuccess,

    handleSelectBox,
    handleCreateBox,
    handleContinueWithBox,

    handleGenerateLabel,
    handleSkipLabel,
    handleLabelQuantityChange,
    handleConfirmLabelQuantity,

    handleFinishUnit,

    setStep,
  };
}
