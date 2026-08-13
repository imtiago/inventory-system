import { useEffect } from "react";
import { useForm } from "react-hook-form";

export interface InventoryLotFormData {
  batchNumber: string;
  expirationDate: string;
  boxCode: string;
  quantity: number;
}

interface Props {
  initialBoxCode?: string | null;

  initialExpirationDate?: string | null;

  boxLocked?: boolean;

  expirationLocked?: boolean;

  boxLoading?: boolean;

  submitting?: boolean;

  boxError?: string | null;

  submitError?: string | null;

  onBatchBlur?(batchNumber: string): void;

  onSubmit(data: InventoryLotFormData): void;

  onCancel(): void;
}

export function InventoryLotForm({
  initialBoxCode = "",
  initialExpirationDate = "",
  boxLocked = false,
  expirationLocked = false,
  boxLoading = false,
  submitting = false,
  boxError = null,
  submitError = null,
  onBatchBlur,
  onSubmit,
  onCancel,
}: Props) {
  const { register, handleSubmit, setValue } = useForm<InventoryLotFormData>({
    defaultValues: {
      batchNumber: "",
      expirationDate: initialExpirationDate ?? "",
      boxCode: initialBoxCode ?? "",
      quantity: 1,
    },
  });

  useEffect(() => {
    setValue("boxCode", initialBoxCode ?? "");
  }, [initialBoxCode, setValue]);

  useEffect(() => {
    setValue("expirationDate", initialExpirationDate ?? "");
  }, [initialExpirationDate, setValue]);

  function handleBatchBlur(batchNumber: string) {
    const normalizedBatch = batchNumber.trim();

    if (!normalizedBatch) {
      return;
    }

    onBatchBlur?.(normalizedBatch);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div
        className="
          bg-white
          rounded-xl
          shadow
          p-6
          space-y-5
        "
      >
        {/* Lote */}

        <div>
          <label className="block mb-1">Lote</label>

          <input
            {...register("batchNumber", {
              required: "Informe o lote.",
            })}
            onBlur={(event) => handleBatchBlur(event.target.value)}
            className="
              w-full
              border
              rounded-lg
              p-3
            "
            placeholder="Ex: 123"
          />

          {boxLoading && (
            <p className="mt-2 text-sm text-gray-500">🔎 Verificando lote...</p>
          )}

          {boxError && <p className="mt-2 text-sm text-red-600">{boxError}</p>}
        </div>

        {/* Validade */}

        <div>
          <label className="block mb-1">Validade</label>

          <input
            type="date"
            {...register("expirationDate", {
              required: "Informe a validade.",
            })}
            readOnly={expirationLocked}
            className={`
              w-full
              border
              rounded-lg
              p-3
              ${expirationLocked ? "bg-gray-100" : ""}
            `}
          />

          {expirationLocked && (
            <p className="mt-2 text-sm text-gray-500">
              🔒 Validade definida pelo lote existente.
            </p>
          )}
        </div>

        {/* Caixa */}

        <div>
          <label className="block mb-1">Caixa</label>

          <input
            {...register("boxCode")}
            readOnly={boxLocked}
            className={`
              w-full
              border
              rounded-lg
              p-3
              ${boxLocked ? "bg-gray-100" : ""}
            `}
            placeholder={
              boxLocked
                ? "Caixa definida"
                : "Será definida após verificar o lote"
            }
          />

          {boxLocked && initialBoxCode && (
            <div
              className="
                  mt-2
                  bg-gray-100
                  border
                  rounded-lg
                  p-3
                "
            >
              <p className="font-medium">📦 Caixa já definida</p>

              <p className="text-sm text-gray-600">
                Este produto/lote já está associado à caixa{" "}
                <strong>{initialBoxCode}</strong>.
              </p>

              <p className="text-sm text-gray-600 mt-1">
                A caixa não pode ser alterada.
              </p>
            </div>
          )}

          {!boxLocked && !boxLoading && (
            <p className="mt-2 text-sm text-gray-500">
              Informe o lote para verificar a caixa.
            </p>
          )}
        </div>

        {/* Quantidade */}

        <div>
          <label className="block mb-1">Quantidade</label>

          <input
            type="number"
            min={1}
            {...register("quantity", {
              required: "Informe a quantidade.",
              valueAsNumber: true,
              min: {
                value: 1,
                message: "A quantidade deve ser maior que zero.",
              },
            })}
            className="
              w-full
              border
              rounded-lg
              p-3
            "
          />
        </div>
      </div>

      {/* Ações */}
      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4">
          {submitError}
        </div>
      )}

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
          disabled={boxLoading || submitting}
          className="
    border
    px-6
    py-3
    rounded-lg
    disabled:opacity-50
  "
        >
          Voltar
        </button>

        <button
          type="submit"
          disabled={boxLoading || submitting}
          className="
    bg-black
    text-white
    rounded-lg
    px-6
    py-3
    disabled:opacity-50
  "
        >
          {submitting ? "Registrando..." : "Registrar"}
        </button>
      </div>
    </form>
  );
}
