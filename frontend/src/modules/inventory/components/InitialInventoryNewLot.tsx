import { InventoryLotForm, type InventoryLotFormData } from './InventoryLotForm';

import { useCreateInventoryLot } from '../hooks/useCreateInventoryLot';

interface Props {
  variantName: string;
  variantCode: string;
  productVariantId: string;

  onCancel(): void;

  onSuccess(lot: any): void;
}

export function InitialInventoryNewLot({ variantName, variantCode, productVariantId, onCancel, onSuccess }: Props) {
  const { create, loading, error } = useCreateInventoryLot();

  async function handleSubmit(data: InventoryLotFormData) {
    const result = await create({
      productVariantId,
      batchNumber: data.batchNumber,
      manufacturingDate: data.manufacturingDate || undefined,
      unitCost: data.unitCost,
      // expirationDate: data.expirationDate,
      expirationDate: new Date(data.expirationDate).toUTCString(),
      quantity: data.quantity,
    });

    if (!result) {
      return;
    }

    onSuccess(result);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-gray-50">
        <div className="border-b bg-white p-6">
          <h2 className="text-xl font-semibold">Criar novo lote</h2>

          <div className="mt-2 text-sm text-gray-600">
            <p>
              <strong>Variante:</strong> {variantName}
            </p>

            <p>
              <strong>Código:</strong> {variantCode}
            </p>
          </div>
        </div>

        <div className="p-6">
          <InventoryLotForm submitting={loading} submitError={error} onSubmit={handleSubmit} onCancel={onCancel} />
        </div>
      </div>
    </div>
  );
}
