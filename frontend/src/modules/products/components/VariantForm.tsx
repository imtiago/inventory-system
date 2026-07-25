import { useForm } from "react-hook-form";
import { useState } from "react";

import { BarcodeScanner } from "@/components/BarcodeScanner";

export interface VariantFormData {
  name: string;
  barcode?: string;
}

interface Props {
  title: string;

  submitLabel: string;

  initialValues?: Partial<VariantFormData>;

  onSubmit(data: VariantFormData): void;

  onCancel(): void;
}

export function VariantForm({
  title,
  submitLabel,
  initialValues,
  onSubmit,
  onCancel,
}: Props) {
  const { register, handleSubmit, setValue } = useForm<VariantFormData>({
    defaultValues: initialValues,
  });
  const [scannerOpen, setScannerOpen] = useState(false);

  function handleBarcodeRead(barcode: string) {
    setValue("barcode", barcode);

    setScannerOpen(false);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
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
          <label className="block mb-1">Nome</label>

          <input
            {...register("name")}
            className="
              w-full
              border
              rounded-lg
              p-3
            "
            placeholder="Ex: Kaiak 100ml"
          />
        </div>

        {/* Código de barras */}

        <div>
          <label className="block mb-1">Código de barras</label>

          <div className="flex gap-3">
            <input
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
          className="bg-black text-white rounded-lg px-6 py-3"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
