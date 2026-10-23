import { applySubmitError } from "@/shared/utils/applyFieldErrors";
import { useForm } from "react-hook-form";
import type { Brand, Category } from "../types";

export interface ProductFormData {
  name: string;
  description?: string;
  brandId: string;
  categoryId: string;
}

interface Props {
  title: string;
  description: string;

  brands: Brand[];

  categories: Category[];

  initialValues?: Partial<ProductFormData>;

  onSubmit(data: ProductFormData): void | Promise<void>;

  onCancel(): void;
}

const FIELDS = ["name", "description", "brandId", "categoryId"] as const;

export function ProductForm({
  title,
  description,
  brands,
  categories,
  initialValues,
  onSubmit,
  onCancel,
}: Props) {
  const { register, handleSubmit, setError, formState: { errors } } = useForm<ProductFormData>({
    defaultValues: initialValues,
  });

  const submit = handleSubmit(async (data) => {
    try {
      await onSubmit(data);
    } catch (error) {
      if (!applySubmitError(setError, error, FIELDS)) throw error;
    }
  });

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-500">{title}</h1>

        <p className="text-gray-500">{description}</p>
      </div>

      <div className="bg-white rounded-xl shadow p-6 space-y-6">
        <section>
          <h2 className="font-semibold text-lg mb-4">Informações Gerais</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="product-name" className="block mb-1">Nome</label>

              <input
                id="product-name"
                {...register("name")}
                className="w-full border rounded-lg p-3"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
            </div>

            <div>
              <label htmlFor="product-description" className="block mb-1">Descrição</label>

              <textarea
                id="product-description"
                {...register("description")}
                rows={4}
                className="w-full border rounded-lg p-3"
              />
              {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>}
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-lg mb-4">Classificação</h2>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label htmlFor="product-brandId" className="block mb-1">Marca</label>

              <select
                id="product-brandId"
                {...register("brandId")}
                className="w-full border rounded-lg p-3"
              >
                <option value="">Selecione...</option>

                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
              {errors.brandId && <p className="mt-1 text-sm text-red-600">{errors.brandId.message}</p>}
            </div>

            <div>
              <label htmlFor="product-categoryId" className="block mb-1">Categoria</label>

              <select
                id="product-categoryId"
                {...register("categoryId")}
                className="w-full border rounded-lg p-3"
              >
                <option value="">Selecione...</option>

                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && <p className="mt-1 text-sm text-red-600">{errors.categoryId.message}</p>}
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="border rounded-lg px-6 py-3"
        >
          Cancelar
        </button>

        <button
          type="submit"
          className="bg-black text-white rounded-lg px-6 py-3"
        >
          Salvar Produto
        </button>
      </div>
          {errors.root?.server && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errors.root.server.message}
        </div>
      )}
    </form>
  );
}
