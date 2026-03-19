import { useParams } from "react-router-dom";
import { ProductForm } from "../components/ProductForm";
import { useProduct } from "../hooks/useProducts";

export function ProductEditPage() {
  const { id } = useParams();

  const { data, isLoading } = useProduct(id!);

  if (isLoading) return <p>Carregando...</p>;

  return (
    <div>
      <h1>Editar Produto</h1>

      <ProductForm
        productId={id}
        defaultValues={{
          name: data.name,
          sku: data.sku,
          brandId: data.brandId,
          categoryId: data.categoryId,
        }}
      />
    </div>
  );
}
