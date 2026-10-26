import { InitialInventoryHeader } from '../components/InitialInventoryHeader';
import { InitialInventoryScanner } from '../components/InitialInventoryScanner';
import { InitialInventoryStart } from '../components/InitialInventoryStart';
import { InitialInventoryProductChoice } from '../components/InitialInventoryProductChoice';
import { InitialInventoryNewProduct } from '../components/InitialInventoryNewProduct';
import { InitialInventoryVariantRegistration } from '../components/InitialInventoryVariantRegistration';
import { InitialInventoryLotStep } from '../components/InitialInventoryLotStep';
import { InitialInventoryBoxStep } from '../components/InitialInventoryBoxStep';
import { InitialInventoryLabelChoice } from '../components/InitialInventoryLabelChoice';
import { InitialInventoryLabelQuantity } from '../components/InitialInventoryLabelQuantity';
import { InitialInventoryLabelsReady } from '../components/InitialInventoryLabelsReady';
import { InitialInventoryProductSelection } from '../components/InitialInventoryProductSelection';
import { InventoryLotForm } from '../components/InventoryLotForm';

import { useInitialInventoryFlow } from '../hooks/useInitialInventoryFlow';
import { Modal } from '@/shared/components/Modal/Modal';

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
};

export function InitialInventoryPage() {
  const flow = useInitialInventoryFlow();

  const currentModal = flow.modal ? modalConfig[flow.modal] : null;

  return (
    <div className="space-y-6">
      <InitialInventoryHeader title="Inventário Inicial" description="Cadastre os produtos e organize o estoque inicial." />

      {flow.step === 'start' && (
        <>
          {flow.placementMessage && (
            <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
              {flow.placementMessage}
            </div>
          )}

          <InitialInventoryStart onScanBarcode={flow.handleStartWithBarcode} onRegisterWithoutBarcode={flow.handleStartWithoutBarcode} />
        </>
      )}

      {/* Selecting "Ler código de barras" does not open the camera; the scanner button does. */}
      {flow.step === 'scan' && (
        <>
          <InitialInventoryScanner
            barcode={flow.barcode}
            loading={flow.barcodeLoading}
            scannerOpen={flow.scannerOpen}
            onOpenScanner={flow.handleOpenScanner}
            onCloseScanner={flow.handleCloseScanner}
            onBarcodeRead={flow.handleBarcodeRead}
          />

          {flow.barcodeLoading && <div className="rounded-xl bg-white p-6 text-center shadow">Consultando produto...</div>}

          {flow.barcodeError && !flow.barcodeLoading && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
              {flow.barcodeError}
            </div>
          )}

          <button type="button" onClick={flow.handleBackToStart} className="rounded-lg border px-6 py-3">
            Voltar
          </button>
        </>
      )}

      {/* Shown behind the product search modal too, so closing it never leaves an empty page. */}
      {(flow.step === 'product-exists-choice' || flow.step === 'product-search') && (
        <InitialInventoryProductChoice barcode={flow.barcode || null} onRegisterVariant={flow.handleProductExists} onRegisterProduct={flow.handleOpenNewProduct} onBack={flow.handleBackToStart} />
      )}

      {flow.step === 'register-variant' && flow.product && (
        <InitialInventoryVariantRegistration
          barcode={flow.barcode || null}
          productId={flow.product.id}
          productName={flow.product.name}
          onCancel={flow.handleBackFromVariant}
          onChosen={flow.handleVariantChosen}
        />
      )}

      {flow.step === 'lot' && flow.variant && (
        <InitialInventoryLotStep
          variant={flow.variant}
          barcode={flow.barcode}
          lots={flow.lots}
          lotsLoading={flow.lotsLoading}
          lotsError={flow.lotsError}
          selectedLotId={flow.selectedLotId}
          selectedLot={flow.selectedLot}
          onSelectLot={flow.handleSelectLot}
          onConfirmLot={flow.handleConfirmLot}
          onCreateNewLot={flow.handleOpenNewLotModal}
          onBack={flow.handleBackToStart}
        />
      )}

      {flow.step === 'box' && flow.selectedLot && (
        <InitialInventoryBoxStep
          lot={flow.selectedLot}
          availableForBoxes={flow.lotAvailableForBoxes}
          selectedBox={flow.selectedBox}
          loading={flow.boxLoading}
          error={flow.boxError}
          onSelectBox={flow.handleSelectBox}
          onCreateBox={flow.handleCreateBox}
          onAddToBox={flow.handleAddToBox}
          onBack={flow.handleBackToLot}
        />
      )}

      {flow.step === 'label-choice' && flow.selectedBox && flow.placementMessage && (
        <InitialInventoryLabelChoice message={flow.placementMessage} boxCode={flow.selectedBox.code} onGenerateLabel={flow.handleGenerateLabel} onSkipLabel={flow.handleSkipLabel} />
      )}

      {flow.step === 'label-quantity' && flow.selectedBox && (
        <InitialInventoryLabelQuantity
          boxCode={flow.selectedBox.code}
          quantity={flow.labelQuantity}
          loading={flow.labelLoading}
          error={flow.labelError}
          onChange={flow.handleLabelQuantityChange}
          onConfirm={flow.handleConfirmLabelQuantity}
          onCancel={flow.handleBackToLabelChoice}
        />
      )}

      {flow.step === 'labels-ready' && flow.selectedBox && (
        <InitialInventoryLabelsReady
          boxCode={flow.selectedBox.code}
          canShare={flow.canShareLabels}
          error={flow.labelError}
          onDownload={flow.handleDownloadLabels}
          onShare={flow.handleShareLabels}
          onRegenerate={flow.handleRegenerateLabels}
          onContinue={flow.handleFinishUnit}
        />
      )}

      <Modal open={flow.modal !== null} onClose={flow.closeModal} closeOnEscape={!flow.modalLocked} closeOnOverlayClick={!flow.modalLocked} showCloseButton={!flow.modalLocked} title={currentModal?.title ?? ''} description={currentModal?.subtitle}>
        {flow.modal === 'new-product' && <InitialInventoryNewProduct onCancel={flow.closeModal} onSuccess={flow.handleNewProductSuccess} />}

        {flow.modal === 'product-selection' && (
          <InitialInventoryProductSelection
            products={flow.productSearch.products}
            loading={flow.productSearch.loading}
            error={flow.productSearch.error}
            onSearch={flow.productSearch.searchProducts}
            onSelect={flow.handleProductSelected}
            onBack={flow.closeModal}
          />
        )}

        {flow.modal === 'new-lot' && <InventoryLotForm submitting={flow.createLotLoading} submitError={flow.createLotError} onSubmit={flow.handleNewLotSubmit} onCancel={flow.closeModal} />}
      </Modal>
    </div>
  );
}
