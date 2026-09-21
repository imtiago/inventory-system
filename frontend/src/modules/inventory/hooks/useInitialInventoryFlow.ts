import { useEffect, useState } from 'react';

import { useProductByBarcode } from './useProductByBarcode';

import { useInventoryLotsByVariant } from './useInventoryLotsByVariant';

import { useInventoryBoxByLot, type InventoryBox } from './useInventoryBoxByLot';

import { useInventoryBox } from './useInventoryBox';

import { useCreateInventoryLot } from './useCreateInventoryLot';

import type { InventoryLot, Product, ProductVariant } from '../types/InitialInventoryTypes';

type FlowStep = 'scan' | 'product-choice' | 'register-variant' | 'lot' | 'box';

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

  const [existingBox, setExistingBox] = useState<InventoryBox | null>(null);

  const [boxId, setBoxId] = useState<string | null>(null);

  const [boxCode, setBoxCode] = useState('');

  const [boxLocked, setBoxLocked] = useState(false);

  const [inventoryQuantity, setInventoryQuantity] = useState<number | null>(null);

  const { foundVariant, loading, searchByBarcode, clearFoundVariant } = useProductByBarcode();

  const { lots, loading: lotsLoading, error: lotsError, findLots, clearLots } = useInventoryLotsByVariant();

  const { findBoxByLot, loading: boxLookupLoading, error: boxLookupError, clearBox } = useInventoryBoxByLot();

  const { createBox, addLot, loading: boxMutationLoading, error: boxMutationError, clearError: clearBoxMutationError } = useInventoryBox();

  const currentVariant = createdVariant ?? foundVariant;

  const selectedLot = lots.find((lot) => lot.id === selectedLotId) ?? null;

  useEffect(() => {
    if (!currentVariant) {
      clearLots();
      return;
    }

    findLots(currentVariant.id);
  }, [currentVariant?.id]);

  useEffect(() => {
    if (!foundVariant) {
      return;
    }

    setBarcode(foundVariant.barcode ?? '');
    setNotFoundBarcode(null);
    setSelectedLotId(null);
    setLotConfirmed(false);
    setExistingBox(null);
    setBoxId(null);
    setBoxCode('');
    setBoxLocked(false);
    setInventoryQuantity(null);

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
    setExistingBox(null);
    setBoxId(null);
    setBoxCode('');
    setBoxLocked(false);
    setInventoryQuantity(null);

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
    setExistingBox(null);
    setBoxId(null);
    setBoxCode('');
    setBoxLocked(false);
    setInventoryQuantity(null);

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
    setExistingBox(null);
    setBoxId(null);
    setBoxCode('');
    setBoxLocked(false);
    setInventoryQuantity(null);

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

    setExistingBox(null);
    setBoxId(null);
    setBoxCode('');
    setBoxLocked(false);
    setInventoryQuantity(null);

    clearBox();
    clearBoxMutationError();

    setLotConfirmed(true);

    const batchNumber = selectedLot.batchNumber;

    if (!batchNumber) {
      setStep('box');
      return;
    }

    const box = await findBoxByLot(currentVariant.id, batchNumber);

    if (box) {
      setExistingBox(box);
      setBoxId(box.id);
      setBoxCode(box.code);
      setBoxLocked(true);
    }

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

    setExistingBox(null);
    setBoxId(null);
    setBoxCode('');
    setBoxLocked(false);
    setInventoryQuantity(null);

    clearBox();
    clearBoxMutationError();

    if (newLot.batchNumber) {
      const box = await findBoxByLot(currentVariant.id, newLot.batchNumber);

      if (box) {
        setExistingBox(box);
        setBoxId(box.id);
        setBoxCode(box.code);
        setBoxLocked(true);
      }
    }

    setStep('box');
  }

  async function handleCreateBox(code: string, quantity: number) {
    if (!selectedLot) {
      return false;
    }

    clearBoxMutationError();

    const createdBox = await createBox({
      code,
    });

    if (!createdBox) {
      return false;
    }

    const addedLot = await addLot(createdBox.id, {
      inventoryLotId: selectedLot.id,
      quantity,
    });

    if (!addedLot) {
      return false;
    }

    setBoxId(createdBox.id);
    setBoxCode(createdBox.code);
    setBoxLocked(true);
    setInventoryQuantity(quantity);

    return true;
  }

  function handleContinueWithBox(quantity: number) {
    if (!selectedLot) {
      return;
    }

    if (!boxId) {
      return;
    }

    setInventoryQuantity(quantity);

    /*
     * Aqui será chamada a rotina final
     * de POST /inventory/initial-count
     * quando tivermos o contrato exato da rota.
     */
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

    existingBox,
    boxId,
    boxCode,
    boxLocked,

    inventoryQuantity,

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

    handleCreateBox,
    handleContinueWithBox,

    setStep,
  };
}
