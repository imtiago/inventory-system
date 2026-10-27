import { MoneyInput, FieldError, fieldA11y, fieldErrorId } from '@/shared/components/form';
import { Camera } from "lucide-react";
import { PageHeader } from "@/shared/components/layout/PageHeader";
import { formatMoneyInput, moneyTextError, parseMoneyToCents } from '@/shared/utils/money';
import { useSingleSubmit } from "@/shared/hooks/useSingleSubmit";
import { applySubmitError } from "@/shared/utils/applyFieldErrors";
import { useForm } from "react-hook-form";
import { useCan } from "@/shared/auth/useCan";
import { useState } from "react";

import { TargetMarginField } from "@/modules/pricing/components/TargetMarginField";
import { marginBpsToText, marginChange, validateTargetMargin } from "@/modules/pricing/utils/targetMargin";
import { BarcodeScanner } from "@/components/BarcodeScanner";

export interface VariantFormData {
  name: string;
  /** Em branco vira null no envio (backend trata como "sem código de barras"). */
  barcode?: string | null;
  /** R$; vazio = não informado (backend assume 0 na criação). */
  salePrice?: number;
  /** Margem desejada em bps; só com `pricing.manage`. Ausente = não mexeu; null = removida. */
  targetMarginBps?: number | null;
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
  targetMargin?: string;
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
  const canMargin = useCan("pricing.manage");
  const { targetMarginBps: initialMargin, ...initialRest } = initialValues ?? {};
  const { register, handleSubmit, setValue, setError, formState: { errors, isSubmitting, dirtyFields } } = useForm<FormValues>({
    defaultValues: {
      ...initialRest,
      salePrice: initialValues?.salePrice === undefined ? "" : formatMoneyInput(initialValues.salePrice),
      targetMargin: marginBpsToText(initialMargin),
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

      const { targetMargin, ...fields } = data;

      await onSubmit({ ...fields, salePrice: cents === null ? undefined : cents / 100, barcode: data.barcode?.trim() || null, ...marginChange(canMargin, Boolean(dirtyFields.targetMargin), targetMargin) });
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
            id="variant-name" {...fieldA11y("variant-name", errors.name?.message)}
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
              <FieldError id="variant-name" message={errors.name?.message} />
        </div>

        {/* Código de barras */}

        <div>
          <label htmlFor="variant-barcode" className="block mb-1">Código de barras</label>

          <div className="flex gap-3">
            <input
              id="variant-barcode" {...fieldA11y("variant-barcode", errors.barcode?.message)}
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
          <FieldError id="variant-barcode" message={errors.barcode?.message} />
        </div>

        {/* Preço de venda */}

        <div>
          <label htmlFor="variant-sale-price" className="block mb-1">Preço de venda (R$)</label>

          <MoneyInput
            id="variant-sale-price"
            {...fieldA11y("variant-sale-price", errors.salePrice?.message)}
            aria-describedby={[priceReadOnly ? "variant-sale-price-hint" : null, errors.salePrice ? fieldErrorId("variant-sale-price") : null].filter(Boolean).join(" ") || undefined}
            readOnly={priceReadOnly}
            {...register("salePrice", {
              validate: (value) => validateSalePrice(value, priceRequired),
            })}
          />
          {priceReadOnly && <p id="variant-sale-price-hint" className="mt-1 text-sm text-muted">Somente o administrador altera o preço</p>}
          <FieldError id="variant-sale-price" message={errors.salePrice?.message} />
        </div>

        <TargetMarginField id="variant-target-margin" error={errors.targetMargin?.message} {...register("targetMargin", { validate: validateTargetMargin })} />

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
