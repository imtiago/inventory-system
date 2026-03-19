import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { useCreateProduct } from "../hooks/useCreateProduct";
import { useUpdateProduct } from "../hooks/useUpdateProduct";

import { useBrands } from "@/modules/brands/hooks/useBrands";
import { useCategories } from "@/modules/categories/hooks/useCategories";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  sku: z.string().min(1, "SKU obrigatório"),
  brandId: z.string().optional(),
  categoryId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type Props = {
  defaultValues?: FormData;
  productId?: string;
  onSuccess?: () => void;
};

export function ProductForm({ defaultValues, productId, onSuccess }: Props) {
  const { data: brands } = useBrands();
  const { data: categories } = useCategories();

  const { mutate: create } = useCreateProduct();
  const { mutate: update } = useUpdateProduct();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const onSubmit = (data: FormData) => {
    if (productId) {
      update({ id: productId, data }, { onSuccess });
    } else {
      create(data, { onSuccess });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-md">
      {/* Nome */}
      <div>
        <label>Nome</label>
        <Input {...form.register("name")} placeholder="Ex: Perfume Kaiak" />
        {form.formState.errors.name && (
          <p className="text-red-500">{form.formState.errors.name.message}</p>
        )}
      </div>

      {/* SKU */}
      <div>
        <label>SKU</label>
        <Input {...form.register("sku")} placeholder="Ex: KAI-100" />
        {form.formState.errors.sku && (
          <p className="text-red-500">{form.formState.errors.sku.message}</p>
        )}
      </div>

      {/* Marca */}
      <div>
        <label>Marca</label>
        <Controller
          control={form.control}
          name="brandId"
          render={({ field }) => (
            <select
              {...field}
              className="border border-gray-300 rounded px-2 py-1 w-full"
            >
              <option value="">Selecione a marca</option>
              {brands?.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        />
      </div>

      {/* Categoria */}
      <div>
        <label>Categoria</label>
        <Controller
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <select
              {...field}
              className="border border-gray-300 rounded px-2 py-1 w-full"
            >
              <option value="">Selecione a categoria</option>
              {categories?.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        />
      </div>

      {/* Botão */}
      <Button type="submit" className="w-full">
        {form.formState.isSubmitting ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
