import { useBrands } from '@/modules/brands/hooks/useBrands';
import { useCategories } from '@/modules/categories/hooks/useCategories';
import { ProductForm, type ProductFormData } from '@/modules/products/components/ProductForm';
import { useCreateProduct } from '@/modules/products/hooks/useCreateProduct';
import { Modal } from '@/shared/components/Modal/Modal';

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

      onSuccess(product);
    } catch (error) {
      console.error('Erro ao cadastrar produto:', error);
    }
  }

  return <ProductForm title="" description="" brands={brands} categories={categories} onSubmit={handleSubmit} onCancel={onCancel} />;
  // return (
  //   <Modal open={true} onClose={onCancel} title="Cadastrar novo produto" description="Informe os dados do novo produto." size="md">
  //     <ProductForm title="" description="" brands={brands} categories={categories} onSubmit={handleSubmit} onCancel={onCancel} />
  //   </Modal>
  // );
}
