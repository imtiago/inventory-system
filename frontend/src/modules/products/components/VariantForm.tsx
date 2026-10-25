import { MoneyInput } from '@/shared/components/form';
import { parseMoneyText } from '@/shared/utils/money';
import { useSingleSubmit } from "@/shared/hooks/useSingleSubmit";
import { applySubmitError } from "@/shared/utils/applyFieldErrors";
import { useForm } from "react-hook-form";
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

  submitLabel: string;

  initialValues?: Partial<VariantFormData>;

  onSubmit(data: VariantFormData): void | Promise<void>;

  onCancel(): void;

  /** Edição: o preço é obrigatório (vazio não pode "manter" o preço antigo em silêncio). */
  requireSalePrice?: boolean;
}

const FIELDS = ["name", "barcode", "salePrice"] as const;

function validateSalePrice(value: number | undefined, required: boolean) {
  if (value === undefined) return required ? "Informe o preço de venda." : true;
  if (Number.isNaN(value)) return "Informe um preço válido.";
  if (value < 0) return "O preço não pode ser negativo.";
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) return "O preço deve ter no máximo 2 casas decimais.";

  return true;
}

export function VariantForm({
  title,
  submitLabel,
  initialValues,
  onSubmit,
  onCancel,
  requireSalePrice = false,
}: Props) {
  const { register, handleSubmit, setValue, setError, formState: { errors, isSubmitting } } = useForm<VariantFormData>({
    defaultValues: initialValues,
  });
  const [scannerOpen, setScannerOpen] = useState(false);

  function handleBarcodeRead(barcode: string) {
    setValue("barcode", barcode);

    setScannerOpen(false);
  }

  const once = useSingleSubmit();

  const submit = handleSubmit(once(async (data) => {
    try {
      await onSubmit({ ...data, barcode: data.barcode?.trim() || null });
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
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>

        <p className="text-gray-500">
          Cadastre uma unidade comercial do produto.
        </p>
      </div>

      <div
        className="
          bg-white
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
              rounded-lg
              p-3
            "
            placeholder="Ex: Kaiak 100ml"
          />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
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
                rounded-lg
                p-3
              "
              placeholder="EAN"
            />

            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="
                bg-gray-900
                text-white
                px-4
                rounded-lg
              "
            >
              📷 Ler
            </button>
          </div>
          {errors.barcode && <p className="mt-1 text-sm text-red-600">{errors.barcode.message}</p>}
        </div>

        {/* Preço de venda */}

        <div>
          <label htmlFor="variant-sale-price" className="block mb-1">Preço de venda (R$)</label>

          <MoneyInput
            id="variant-sale-price"
            {...register("salePrice", {
              setValueAs: (value) => (value === "" || value == null ? undefined : parseMoneyText(String(value))),
              validate: (value) => validateSalePrice(value, requireSalePrice),
            })}
          />
          {errors.salePrice && <p className="mt-1 text-sm text-red-600">{errors.salePrice.message}</p>}
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
                  text-red-600
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
          className="bg-black text-white rounded-lg px-6 py-3 disabled:opacity-50"
        >
          {isSubmitting ? "Salvando..." : submitLabel}
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
