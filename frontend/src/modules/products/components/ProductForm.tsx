import { useSingleSubmit } from "@/shared/hooks/useSingleSubmit";
import { applySubmitError } from "@/shared/utils/applyFieldErrors";
import { Controller, useForm } from "react-hook-form";

import { EntitySearchSelect } from "@/shared/components/form/EntitySearchSelect";
import { useBrands } from "@/modules/brands/hooks/useBrands";
import { useCategories } from "@/modules/categories/hooks/useCategories";
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

  /** Current brand/category (edit): shown by name even when not in the first page of search results. */
  initialBrand?: Brand;

  initialCategory?: Category;

  initialValues?: Partial<ProductFormData>;

  onSubmit(data: ProductFormData): void | Promise<void>;

  onCancel(): void;
}

const FIELDS = ["name", "description", "brandId", "categoryId"] as const;

export function ProductForm({
  title,
  description,
  initialBrand,
  initialCategory,
  initialValues,
  onSubmit,
  onCancel,
}: Props) {
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<ProductFormData>({
    defaultValues: initialValues,
  });

  const once = useSingleSubmit();

  const submit = handleSubmit(once(async (data) => {
    try {
      await onSubmit(data);
    } catch (error) {
      if (!applySubmitError(setError, error, FIELDS)) throw error;
    }
  }));

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        {title && <h1 className="text-2xl font-semibold text-foreground">{title}</h1>}

        <p className="text-muted">{description}</p>
      </div>

      <div className="bg-surface rounded-xl shadow p-6 space-y-6">
        <section>
          <h2 className="font-semibold text-lg mb-4">Informações Gerais</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="product-name" className="block mb-1">Nome</label>

              <input
                id="product-name"
                {...register("name")}
                className="w-full rounded-lg border border-input bg-surface text-foreground p-3"
              />
              {errors.name && <p className="mt-1 text-sm text-danger">{errors.name.message}</p>}
            </div>

            <div>
              <label htmlFor="product-description" className="block mb-1">Descrição</label>

              <textarea
                id="product-description"
                {...register("description")}
                rows={4}
                className="w-full rounded-lg border border-input bg-surface text-foreground p-3"
              />
              {errors.description && <p className="mt-1 text-sm text-danger">{errors.description.message}</p>}
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-semibold text-lg mb-4">Classificação</h2>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Controller
              control={control}
              name="brandId"
              render={({ field, fieldState }) => (
                <EntitySearchSelect
                  useOptions={useBrands}
                  label="Marca"
                  placeholder="Buscar marca..."
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  current={initialBrand}
                  error={fieldState.error?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="categoryId"
              render={({ field, fieldState }) => (
                <EntitySearchSelect
                  useOptions={useCategories}
                  label="Categoria"
                  placeholder="Buscar categoria..."
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  current={initialCategory}
                  error={fieldState.error?.message}
                />
              )}
            />
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
          disabled={isSubmitting}
          className="bg-primary text-primary-foreground rounded-lg px-6 py-3 disabled:opacity-50"
        >
          {isSubmitting ? "Salvando..." : "Salvar Produto"}
        </button>
      </div>
          {errors.root?.server && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          {errors.root.server.message}
        </div>
      )}
    </form>
  );
}
