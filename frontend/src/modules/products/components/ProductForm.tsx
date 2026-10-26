import { useSingleSubmit } from "@/shared/hooks/useSingleSubmit";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { applySubmitError } from "@/shared/utils/applyFieldErrors";
import { Controller, useForm } from "react-hook-form";
import { FieldError, MoneyInput, fieldA11y } from "@/shared/components/form";
import { formatMoneyInput, moneyTextError, parseMoneyToCents } from "@/shared/utils/money";

import { EntitySearchSelect } from "@/shared/components/form/EntitySearchSelect";
import { useBrands } from "@/modules/brands/hooks/useBrands";
import { useCategories } from "@/modules/categories/hooks/useCategories";
import type { Brand, Category } from "../types";

export interface ProductFormData {
  name: string;
  description?: string;
  brandId: string;
  categoryId: string;
  /** R$; só no cadastro (a variante Padrão nasce com este preço). */
  salePrice?: number;
}

/** O campo guarda o texto digitado (pt-BR); a conversão para número só acontece no envio. */
type FormValues = Omit<ProductFormData, "salePrice"> & { salePrice?: string };

interface Props {
  title: string;
  description: string;
  /** Destino do "Voltar" do cabeçalho padrão. */
  backPath?: string;
  backLabel?: string;

  /** Current brand/category (edit): shown by name even when not in the first page of search results. */
  initialBrand?: Brand;

  initialCategory?: Category;

  initialValues?: Partial<ProductFormData>;

  /** Cadastro: pede o preço de venda inicial (obrigatório), para o produto não nascer a R$ 0,00. */
  withSalePrice?: boolean;

  onSubmit(data: ProductFormData): void | Promise<void>;

  onCancel(): void;
}

const NAME_MIN = 3;
const NAME_MAX = 120;
const DESCRIPTION_MAX = 500;

function nameError(value: string) {
  const length = value.trim().length;
  if (length === 0) return "O nome é obrigatório.";
  if (length < NAME_MIN) return `O nome deve ter ao menos ${NAME_MIN} caracteres.`;
  if (length > NAME_MAX) return `O nome deve ter no máximo ${NAME_MAX} caracteres.`;
  return true;
}

const FIELDS = ["name", "description", "brandId", "categoryId", "salePrice"] as const;

export function ProductForm({
  title,
  description,
  backPath,
  backLabel,
  initialBrand,
  initialCategory,
  initialValues,
  withSalePrice = false,
  onSubmit,
  onCancel,
}: Props) {
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      ...initialValues,
      salePrice: initialValues?.salePrice === undefined ? "" : formatMoneyInput(initialValues.salePrice),
    },
  });

  const once = useSingleSubmit();

  const submit = handleSubmit(once(async (data) => {
    try {
      const { salePrice: priceText, ...rest } = data;
      const cents = withSalePrice && priceText?.trim() ? parseMoneyToCents(priceText) : null;
      await onSubmit({ ...rest, ...(cents === null ? {} : { salePrice: cents / 100 }) });
    } catch (error) {
      if (!applySubmitError(setError, error, FIELDS)) throw error;
    }
  }));

  return (
    <form onSubmit={submit} className="space-y-6">
      <PageHeader title={title} description={description} backPath={backPath} backLabel={backLabel} />

      <div className="bg-surface rounded-xl shadow p-6 space-y-6">
        <section>
          <h2 className="font-semibold text-lg mb-4">Informações Gerais</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="product-name" className="block mb-1">Nome</label>

              <input
                id="product-name"
                {...register("name", { validate: nameError })}
                {...fieldA11y("product-name", errors.name?.message)}
                className="w-full rounded-lg border border-input bg-surface text-foreground p-3"
              />
              <FieldError id="product-name" message={errors.name?.message} />
            </div>

            <div>
              <label htmlFor="product-description" className="block mb-1">Descrição</label>

              <textarea
                id="product-description"
                {...register("description", {
                  validate: (value) => (value?.trim().length ?? 0) <= DESCRIPTION_MAX || `A descrição deve ter no máximo ${DESCRIPTION_MAX} caracteres.`,
                })}
                {...fieldA11y("product-description", errors.description?.message)}
                rows={4}
                className="w-full rounded-lg border border-input bg-surface text-foreground p-3"
              />
              <FieldError id="product-description" message={errors.description?.message} />
            </div>
          </div>
        </section>

        {withSalePrice && (
          <section>
            <h2 className="font-semibold text-lg mb-4">Preço</h2>

            <div>
              <label htmlFor="product-sale-price" className="block mb-1">Preço de venda (R$)</label>

              <MoneyInput
                id="product-sale-price"
                {...register("salePrice", {
                  validate: (value) => (value?.trim() ? moneyTextError(value) ?? true : "Informe o preço de venda."),
                })}
                {...fieldA11y("product-sale-price", errors.salePrice?.message)}
              />
              <FieldError id="product-sale-price" message={errors.salePrice?.message} />
            </div>
          </section>
        )}

        <section>
          <h2 className="font-semibold text-lg mb-4">Classificação</h2>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Controller
              control={control}
              name="brandId"
              rules={{ validate: (value) => Boolean(value) || "A marca é obrigatória." }}
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
              rules={{ validate: (value) => Boolean(value) || "A categoria é obrigatória." }}
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
