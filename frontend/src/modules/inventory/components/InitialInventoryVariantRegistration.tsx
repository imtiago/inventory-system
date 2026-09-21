import { ProductVariantRegistration } from './ProductVariantRegistration';

import type { ProductVariant } from '../types/InitialInventoryTypes';

interface InitialInventoryVariantRegistrationProps {
  barcode: string;
  productId: string;
  productName: string;
  onCancel: () => void;
  onCreated: (variant: ProductVariant) => void;
}

export function InitialInventoryVariantRegistration({ barcode, onCancel, onCreated, productId, productName }: InitialInventoryVariantRegistrationProps) {
  return <ProductVariantRegistration barcode={barcode} onCancel={onCancel} onSuccess={onCreated} productId={productId} productName={productName} />;
}
