import { useState } from 'react';

import type { ISaleDraftItem } from '../types';
import { toCents } from '@/shared/utils/money';
import type { ProductVariant } from '@/modules/inventory/types';

export function isQuantityValid(quantity: number | null): quantity is number {
  return quantity !== null && Number.isInteger(quantity) && quantity >= 1;
}

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
                quantity: (current.quantity ?? 0) + (item.quantity ?? 0),
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
      unitPrice: variant.salePrice ?? 0,
    });
  }

  /** null = field cleared; validated at submit (isQuantityValid). */
  function updateQuantity(productVariantId: string, quantity: number | null) {
    setItems((currentItems) => currentItems.map((item) => (item.productVariantId === productVariantId ? { ...item, quantity } : item)));
  }

  function removeItem(productVariantId: string) {
    setItems((currentItems) => currentItems.filter((item) => item.productVariantId !== productVariantId));
  }

  function clearItems() {
    setItems([]);
  }

  const totalQuantity = items.reduce((total, item) => total + (item.quantity ?? 0), 0);

  const totalCents = items.reduce((total, item) => total + (item.quantity ?? 0) * toCents(item.unitPrice), 0);

  const hasInvalidQuantity = items.some((item) => !isQuantityValid(item.quantity));

  const itemsWithoutPrice = items.filter((item) => !(item.unitPrice > 0));

  return {
    items,
    addItem,
    addVariant,
    updateQuantity,
    removeItem,
    clearItems,
    totalQuantity,
    totalCents,
    hasInvalidQuantity,
    itemsWithoutPrice,
  };
}
