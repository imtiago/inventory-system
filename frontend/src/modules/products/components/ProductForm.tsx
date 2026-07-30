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

  onSubmit(data: ProductFormData): void;

  onCancel(): void;
}

export function ProductForm({
  title,
  description,
  brands,
  categories,
  initialValues,
  onSubmit,
  onCancel,
}: Props) {
  const { register, handleSubmit } = useForm<ProductFormData>({
    defaultValues: initialValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-500">{title}</h1>

        <p className="text-gray-500">{description}</p>
      </div>

      <div className="bg-white rounded-xl shadow p-6 space-y-6">
        <section>
          <h2 className="font-semibold text-lg mb-4">Informações Gerais</h2>

          <div className="space-y-4">
            <div>
              <label className="block mb-1">Nome</label>

              <input
                {...register("name")}
                className="w-full border rounded-lg p-3"
              />
            </div>

            <div>
              <label className="block mb-1">Descrição</label>

              <textarea
                {...register("description")}
                rows={4}
                className="w-full border rounded-lg p-3"
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-lg mb-4">Classificação</h2>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block mb-1">Marca</label>

              <select
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
            </div>

            <div>
              <label className="block mb-1">Categoria</label>

              <select
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
    </form>
  );
}
