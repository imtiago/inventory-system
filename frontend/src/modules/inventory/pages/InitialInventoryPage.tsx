import { InitialInventoryHeader } from '../components/InitialInventoryHeader';
import { InitialInventoryScanner } from '../components/InitialInventoryScanner';
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

export function InitialInventoryPage() {
  const flow = useInitialInventoryFlow();

  return (
    <div className="space-y-6">
      {flow.step === 'scan' && (
        <>
          <InitialInventoryHeader title="Inventário Inicial" description="Escaneie os produtos para realizar a contagem inicial do estoque." />

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

      {flow.step === 'product-choice' && flow.notFoundBarcode && (
        <InitialInventoryProductChoice
          barcode={flow.notFoundBarcode}
          onRegisterVariant={flow.handleRegisterVariant}
          onRegisterProduct={flow.handleOpenNewProductModal}
          onBack={flow.handleBackToScan}
        />
      )}

      {flow.newProductModalOpen && <InitialInventoryNewProduct onCancel={flow.handleCloseNewProductModal} onSuccess={flow.handleNewProductSuccess} />}

      {flow.step === 'register-variant' && flow.notFoundBarcode && flow.product && (
        <InitialInventoryVariantRegistration
          barcode={flow.notFoundBarcode}
          onCancel={() => flow.setStep('product-choice')}
          onCreated={flow.handleVariantCreated}
          productId={flow.product.id}
          productName={flow.product.name}
        />
      )}

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

      {flow.newLotModalOpen && flow.currentVariant && (
        <InitialInventoryNewLot
          variantName={flow.currentVariant.name}
          variantCode={flow.currentVariant.code}
          productVariantId={flow.currentVariant.id}
          onCancel={flow.handleCloseNewLotModal}
          onSuccess={flow.handleNewLotSuccess}
        />
      )}

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

      {flow.step === 'label-choice' && flow.selectedLot && flow.selectedBox && (
        <InitialInventoryLabelChoice boxCode={flow.selectedBox.code} labelQuantity={flow.labelQuantity} onGenerateLabel={flow.handleGenerateLabel} onSkipLabel={flow.handleSkipLabel} />
      )}

      {flow.step === 'label-quantity' && flow.selectedBox && (
        <InitialInventoryLabelQuantity
          boxCode={flow.selectedBox.code}
          quantity={flow.labelQuantity}
          onChange={flow.handleLabelQuantityChange}
          onConfirm={flow.handleConfirmLabelQuantity}
          onCancel={() => flow.setStep('label-choice')}
        />
      )}
    </div>
  );
}
