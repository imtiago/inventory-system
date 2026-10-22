import { useBrands } from '@/modules/brands/hooks/useBrands';
import { useCategories } from '@/modules/categories/hooks/useCategories';
import { ProductForm, type ProductFormData } from '@/modules/products/components/ProductForm';
import { useCreateProduct } from '@/modules/products/hooks/useCreateProduct';

interface InitialInventoryNewProductProps {
  onCancel: () => void;
  onSuccess: (product: { id: string; name: string }) => void;
}

export function InitialInventoryNewProduct({ onCancel, onSuccess }: InitialInventoryNewProductProps) {
  const { data: brands = [] } = useBrands();
  const { data: categories = [] } = useCategories();

  const createProduct = useCreateProduct();

  async function handleSubmit(data: ProductFormData) {
    try {
      const product = await createProduct.mutateAsync(data);

      onSuccess(product);
    } catch {
      // useCreateProduct already notifies the error; keep the form open.
    }
  }

  return <ProductForm title="" description="" brands={brands} categories={categories} onSubmit={handleSubmit} onCancel={onCancel} />;
}
