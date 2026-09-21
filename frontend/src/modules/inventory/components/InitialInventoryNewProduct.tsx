import { useBrands } from '@/modules/brands/hooks/useBrands';
import { useCategories } from '@/modules/categories/hooks/useCategories';
import { ProductForm, type ProductFormData } from '@/modules/products/components/ProductForm';
import { useCreateProduct } from '@/modules/products/hooks/useCreateProduct';

interface InitialInventoryNewProductProps {
  onCancel: () => void;
  onSuccess: (product: Product) => void;
}

export function InitialInventoryNewProduct({ onCancel, onSuccess }: InitialInventoryNewProductProps) {
  const { data: brands = [] } = useBrands();
  const { data: categories = [] } = useCategories();
  const createProduct = useCreateProduct();

  async function handleSubmit(data: ProductFormData) {
    try {
      const product = await createProduct.mutateAsync(data);

      console.log('Produto criado:', product);

      onSuccess(product);
    } catch (error) {
      console.error('Erro ao cadastrar produto:', error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[75vh] w-full max-w-md overflow-y-auto rounded-xl bg-gray-100 p-4 shadow-xl">
        <ProductForm title="Cadastrar novo produto" description="Informe os dados do novo produto." brands={brands} categories={categories} onSubmit={handleSubmit} onCancel={onCancel} />
      </div>
    </div>
  );
}
