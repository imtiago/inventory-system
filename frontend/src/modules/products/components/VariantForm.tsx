import { MoneyInput } from '@/shared/components/form';
import { Camera } from "lucide-react";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { formatMoneyInput, moneyTextError, parseMoneyToCents } from '@/shared/utils/money';
import { useSingleSubmit } from "@/shared/hooks/useSingleSubmit";
import { applySubmitError } from "@/shared/utils/applyFieldErrors";
import { useForm } from "react-hook-form";
import { useCan } from "@/shared/auth/useCan";
import { useState } from "react";

import { BarcodeScanner } from "@/components/BarcodeScanner";

export interface VariantFormData {
  name: string;
  /** Em branco vira null no envio (backend trata como "sem código de barras"). */
  barcode?: string | null;
  /** R$; vazio = não informado (backend assume 0 na criação). */
  salePrice?: number;
}

interface Props {
  title: string;
  /** Destino do "Voltar" do cabeçalho padrão. */
  backPath?: string;
  backLabel?: string;

  submitLabel: string;

  initialValues?: Partial<VariantFormData>;

  onSubmit(data: VariantFormData): void | Promise<void>;

  onCancel(): void;

  /** Edição: o preço é obrigatório (vazio não pode "manter" o preço antigo em silêncio). */
  requireSalePrice?: boolean;
}

const FIELDS = ["name", "barcode", "salePrice"] as const;

/** O campo guarda o texto digitado (pt-BR); a conversão para número só acontece no envio. */
interface FormValues {
  name: string;
  barcode?: string | null;
  salePrice: string;
}

function validateSalePrice(text: string, required: boolean) {
  if (text.trim() === "") return required ? "Informe o preço de venda." : true;

  return moneyTextError(text) ?? true;
}

export function VariantForm({
  title,
  backPath,
  backLabel,
  submitLabel,
  initialValues,
  onSubmit,
  onCancel,
  requireSalePrice = false,
}: Props) {
  const { register, handleSubmit, setValue, setError, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      ...initialValues,
      salePrice: initialValues?.salePrice === undefined ? "" : formatMoneyInput(initialValues.salePrice),
    },
  });
  const [scannerOpen, setScannerOpen] = useState(false);

  // Só o administrador (catalog.price) altera o preço; os demais só informam o preço inicial (obrigatório).
  const canPrice = useCan("catalog.price");
  // Variante nunca precificada (R$ 0,00): o cadastro inicial do preço é liberado a todos.
  const neverPriced = (initialValues?.salePrice ?? 0) === 0;
  const priceReadOnly = requireSalePrice && !canPrice && !neverPriced;
  const priceRequired = requireSalePrice || !canPrice;

  function handleBarcodeRead(barcode: string) {
    setValue("barcode", barcode);

    setScannerOpen(false);
  }

  const once = useSingleSubmit();

  const submit = handleSubmit(once(async (data) => {
    try {
      const cents = data.salePrice.trim() === "" ? null : parseMoneyToCents(data.salePrice);

      await onSubmit({ ...data, salePrice: cents === null ? undefined : cents / 100, barcode: data.barcode?.trim() || null });
    } catch (error) {
      if (!applySubmitError(setError, error, FIELDS)) throw error;
    }
  }));

  return (
    <form
      noValidate
      onSubmit={submit}
      className="
        space-y-6
      "
    >
      <PageHeader title={title} description="Cadastre uma unidade comercial do produto." backPath={backPath} backLabel={backLabel} />

      <div
        className="
          bg-surface
          rounded-xl
          shadow
          p-6
          space-y-5
        "
      >
        {/* Nome */}

        <div>
          <label htmlFor="variant-name" className="block mb-1">Nome</label>

          <input
            id="variant-name"
            {...register("name")}
            className="
              w-full
              border
              border-input
              bg-surface
              text-foreground
              rounded-lg
              p-3
            "
            placeholder="Ex: Kaiak 100ml"
          />
              {errors.name && <p className="mt-1 text-sm text-danger">{errors.name.message}</p>}
        </div>

        {/* Código de barras */}

        <div>
          <label htmlFor="variant-barcode" className="block mb-1">Código de barras</label>

          <div className="flex gap-3">
            <input
              id="variant-barcode"
              {...register("barcode")}
              className="
                flex-1
                border
                border-input
                bg-surface
                text-foreground
                rounded-lg
                p-3
              "
              placeholder="EAN"
            />

            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="
                bg-primary
                text-primary-foreground
                px-4
                rounded-lg
                inline-flex
                items-center
                gap-2
              "
            >
              <Camera size={18} aria-hidden="true" />
              Ler
            </button>
          </div>
          {errors.barcode && <p className="mt-1 text-sm text-danger">{errors.barcode.message}</p>}
        </div>

        {/* Preço de venda */}

        <div>
          <label htmlFor="variant-sale-price" className="block mb-1">Preço de venda (R$)</label>

          <MoneyInput
            id="variant-sale-price"
            readOnly={priceReadOnly}
            aria-describedby={priceReadOnly ? "variant-sale-price-hint" : undefined}
            {...register("salePrice", {
              validate: (value) => validateSalePrice(value, priceRequired),
            })}
          />
          {priceReadOnly && <p id="variant-sale-price-hint" className="mt-1 text-sm text-muted">Somente o administrador altera o preço</p>}
          {errors.salePrice && <p className="mt-1 text-sm text-danger">{errors.salePrice.message}</p>}
        </div>

        {scannerOpen && (
          <div
            className="
                border
                rounded-lg
                p-4
              "
          >
            <BarcodeScanner onDetected={handleBarcodeRead} />

            <button
              type="button"
              onClick={() => setScannerOpen(false)}
              className="
                  mt-3
                  text-danger
                "
            >
              Cancelar leitura
            </button>
          </div>
        )}
      </div>

      <div
        className="
          flex
          justify-end
          gap-3
        "
      >
        <button
          type="button"
          onClick={onCancel}
          className="
            border
            px-6
            py-3
            rounded-lg
          "
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-primary text-primary-foreground rounded-lg px-6 py-3 disabled:opacity-50"
        >
          {isSubmitting ? "Salvando..." : submitLabel}
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
