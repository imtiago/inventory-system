import { useModalBusy } from '@/shared/components/Modal/useModalBusy';
import { ProductForm, type ProductFormData } from '@/modules/products/components/ProductForm';
import { parseApiErrorSync } from '@/shared/services/parseApiError';
import { useCreateProduct } from '@/modules/products/hooks/useCreateProduct';

interface InitialInventoryNewProductProps {
  onCancel: () => void;
  onSuccess: (product: { id: string; name: string }) => void;
}

export function InitialInventoryNewProduct({ onCancel, onSuccess }: InitialInventoryNewProductProps) {
  const createProduct = useCreateProduct();
  useModalBusy(createProduct.isPending);

  async function handleSubmit(data: ProductFormData) {
    try {
      const product = await createProduct.mutateAsync(data);

      onSuccess(product);
    } catch (error) {
      // useCreateProduct already notifies the error; keep the form open.
      // Backend field errors are rethrown so ProductForm can show them inline.
      if (Object.keys(parseApiErrorSync(error).fieldErrors).length > 0) throw error;
    }
  }

  return <ProductForm title="" description="" onSubmit={handleSubmit} onCancel={onCancel} />;
}
