import { useState } from 'react';

import type { ISaleDraftItem } from '../types';
import type { ProductVariant } from '@/modules/initial-inventory/types/InitialInventoryTypes';

export function useSaleCart() {
  const [items, setItems] = useState<ISaleDraftItem[]>([]);

  function addItem(item: ISaleDraftItem) {
    setItems((currentItems) => {
      const existingItem = currentItems.find((current) => current.productVariantId === item.productVariantId);

      if (existingItem) {
        return currentItems.map((current) =>
          current.productVariantId === item.productVariantId
            ? {
                ...current,
                quantity: current.quantity + item.quantity,
              }
            : current,
        );
      }

      return [...currentItems, item];
    });
  }

  function addVariant(variant: ProductVariant) {
    addItem({
      productVariantId: variant.id,
      productName: variant.name,
      productCode: variant.code,
      quantity: 1,
      unitPrice: 0,
    });
  }

  function updateQuantity(productVariantId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1) {
      return;
    }

    setItems((currentItems) => currentItems.map((item) => (item.productVariantId === productVariantId ? { ...item, quantity } : item)));
  }

  function removeItem(productVariantId: string) {
    setItems((currentItems) => currentItems.filter((item) => item.productVariantId !== productVariantId));
  }

  function clearItems() {
    setItems([]);
  }

  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);

  const estimatedTotal = items.reduce((total, item) => total + item.quantity * item.unitPrice, 0);

  return {
    items,
    addItem,
    addVariant,
    updateQuantity,
    removeItem,
    clearItems,
    totalQuantity,
    estimatedTotal,
  };
}
