import { InitialInventoryHeader } from '../components/InitialInventoryHeader';
import { InitialInventoryScanner } from '../components/InitialInventoryScanner';
import { InitialInventoryStart } from '../components/InitialInventoryStart';
import { InitialInventoryProductNotFound } from '../components/InitialInventoryProductNotFound';
import { InitialInventoryProductChoice } from '../components/InitialInventoryProductChoice';
import { InitialInventoryNewProduct } from '../components/InitialInventoryNewProduct';
import { InitialInventoryVariantRegistration } from '../components/InitialInventoryVariantRegistration';
import { InitialInventoryLotStep } from '../components/InitialInventoryLotStep';
import { InitialInventoryNewLot } from '../components/InitialInventoryNewLot';
import { InitialInventoryBoxStep } from '../components/InitialInventoryBoxStep';
import { InitialInventoryLabelChoice } from '../components/InitialInventoryLabelChoice';
import { InitialInventoryLabelQuantity } from '../components/InitialInventoryLabelQuantity';

import { useInitialInventoryFlow } from '../hooks/useInitialInventoryFlow';
import { InitialInventoryProductSelection } from '../components/InitialInventoryProductSelection';
import { useState } from 'react';
import { Modal } from '@/shared/components/Modal/Modal';
import { InventoryLotForm } from '../components/InventoryLotForm';

const modalConfig = {
  'new-product': {
    title: 'Cadastrar novo produto',
    subtitle: 'Informe os dados do produto.',
  },

  'product-selection': {
    title: 'Selecionar produto',
    subtitle: 'Pesquise e selecione o produto correspondente.',
  },

  'new-lot': {
    title: 'Cadastrar novo lote',
    subtitle: 'Informe os dados do lote.',
  },

  'label-quantity': {
    title: 'Gerar etiquetas',
    subtitle: 'Informe a quantidade de etiquetas.',
  },
};

export function InitialInventoryPage() {
  const flow = useInitialInventoryFlow();

  const currentModal = flow.modal ? modalConfig[flow.modal] : null;

  return (
    <div className="space-y-6">
      <InitialInventoryHeader title="Inventário Inicial" description="Cadastre os produtos e organize o estoque inicial." />

      {/* ============================================================
          INÍCIO
         ============================================================ */}

      {flow.step === 'start' && <InitialInventoryStart onScanBarcode={flow.handleStartWithBarcode} onRegisterWithoutBarcode={flow.handleStartWithoutBarcode} />}

      {/* ============================================================
          LEITURA DO CÓDIGO DE BARRAS

          Importante:
          selecionar "Ler código de barras" NÃO abre a câmera.
          A câmera só abre quando o usuário clicar no botão
          dentro do InitialInventoryScanner.
         ============================================================ */}

      {flow.step === 'scan' && (
        <>
          <InitialInventoryScanner
            barcode={flow.barcode}
            loading={flow.loading}
            scannerOpen={flow.scannerOpen}
            onOpenScanner={flow.handleOpenScanner}
            onCloseScanner={flow.handleCloseScanner}
            onBarcodeRead={flow.handleBarcodeRead}
          />

          {flow.loading && <div className="rounded-xl bg-white p-6 text-center shadow">Consultando produto...</div>}

          {flow.notFoundBarcode && !flow.loading && <InitialInventoryProductNotFound barcode={flow.notFoundBarcode} onContinue={flow.handleRegisterProduct} />}
        </>
      )}

      {/* ============================================================
          PRODUTO EXISTE?

          Esse passo acontece em dois cenários:

          1. Código de barras foi lido, mas a variante não existe.
          2. Usuário escolheu cadastrar sem código de barras.

          Portanto, NÃO devemos verificar notFoundBarcode aqui.
         ============================================================ */}

      {flow.step === 'product-exists-choice' && (
        <InitialInventoryProductChoice
          barcode={flow.barcode || null}
          onRegisterVariant={flow.handleSearchProduct}
          onRegisterProduct={() => flow.openModal('new-product')}
          onBack={flow.handleBackToStart}
        />
      )}

      {/* {flow.step === 'product-search' && flow.notFoundBarcode && (
        <InitialInventoryProductSelection
          barcode={flow.notFoundBarcode}
          products={flow.products}
          loading={flow.productsLoading}
          error={flow.productsError}
          onSearch={flow.searchProducts}
          onSelect={flow.handleNewProductSuccess}
          onBack={() => setStep('product-choice')}
        />
      )} */}

      {/* ============================================================
          NOVO PRODUTO
         ============================================================ */}

      {/* {flow.newProductModalOpen && <InitialInventoryNewProduct onCancel={flow.handleCloseNewProductModal} onSuccess={flow.handleNewProductSuccess} />} */}

      {/* ============================================================
          CADASTRO DA VARIANTE
         ============================================================ */}

      {flow.step === 'register-variant' && flow.product && (
        <InitialInventoryVariantRegistration
          barcode={flow.barcode || undefined}
          onCancel={flow.handleBackToProductChoice}
          onCreated={flow.handleVariantCreated}
          productId={flow.product.id}
          productName={flow.product.name}
        />
      )}

      {/* ============================================================
          LOTE
         ============================================================ */}

      {flow.step === 'lot' && flow.currentVariant && (
        <InitialInventoryLotStep
          variant={flow.currentVariant}
          barcode={flow.barcode}
          lots={flow.lots}
          lotsLoading={flow.lotsLoading}
          lotsError={flow.lotsError}
          selectedLotId={flow.selectedLotId}
          selectedLot={flow.selectedLot}
          lotConfirmed={flow.lotConfirmed}
          onSelectLot={flow.handleSelectLot}
          onConfirmLot={flow.handleConfirmLot}
          onCreateNewLot={flow.handleOpenNewLotModal}
        />
      )}

      {/* ============================================================
          NOVO LOTE
         ============================================================ */}

      {/* {flow.newLotModalOpen && flow.currentVariant && (
        <InitialInventoryNewLot
          variantName={flow.currentVariant.name}
          variantCode={flow.currentVariant.code}
          productVariantId={flow.currentVariant.id}
          onCancel={flow.closeModal}
          onSuccess={flow.handleNewLotSuccess}
        />
      )} */}

      {/* ============================================================
          CAIXA

          Aqui o usuário pode:
          - selecionar uma caixa existente;
          - criar uma nova caixa;
          - continuar com a caixa selecionada.
         ============================================================ */}
      {flow.step === 'box' && flow.selectedLot && (
        <InitialInventoryBoxStep
          lot={flow.selectedLot}
          boxes={flow.boxes}
          boxesLoading={flow.boxLoading}
          boxesError={flow.boxError}
          selectedBox={flow.selectedBox}
          onSelectBox={flow.handleSelectBox}
          onCreateBox={flow.handleCreateBox}
          onContinue={flow.handleContinueWithBox}
        />
      )}

      {/* ============================================================
          GERAR ETIQUETA?
         ============================================================ */}

      {flow.step === 'label-choice' && flow.selectedLot && flow.selectedBox && (
        <InitialInventoryLabelChoice boxCode={flow.selectedBox.code} labelQuantity={flow.labelQuantity} onGenerateLabel={flow.handleGenerateLabel} onSkipLabel={flow.handleSkipLabel} />
      )}

      {/* ============================================================
          QUANTIDADE DE ETIQUETAS
         ============================================================ */}

      {flow.step === 'label-quantity' && flow.selectedBox && (
        <InitialInventoryLabelQuantity
          boxCode={flow.selectedBox.code}
          quantity={flow.labelQuantity}
          loading={flow.labelLoading}
          error={flow.labelError}
          onChange={flow.handleLabelQuantityChange}
          onConfirm={flow.handleConfirmLabelQuantity}
          onCancel={() => flow.setStep('label-choice')}
        />
      )}

      <Modal open={flow.modal !== null} onClose={flow.closeModal} title={currentModal?.title ?? ''} description={currentModal?.subtitle}>
        {/* ============================================================
          NOVO PRODUTO
         ============================================================ */}
        {flow.modal === 'new-product' && <InitialInventoryNewProduct onCancel={flow.closeModal} onSuccess={flow.handleNewProductSuccess} />}
        {flow.modal === 'product-selection' && (
          <InitialInventoryProductSelection
            barcode={flow.notFoundBarcode}
            products={flow.products}
            loading={flow.productsLoading}
            error={flow.productsError}
            onSearch={flow.searchProducts}
            onSelect={flow.handleNewProductSuccess}
            onBack={flow.closeModal}
          />
        )}
        {/* ============================================================
          NOVO LOTE
         ============================================================ */}
        {flow.modal === 'new-lot' && <InventoryLotForm submitting={flow.createLotLoading} submitError={flow.createLotError} onSubmit={flow.handleNewLotSuccess} onCancel={flow.closeModal} />}
      </Modal>
    </div>
  );
}
