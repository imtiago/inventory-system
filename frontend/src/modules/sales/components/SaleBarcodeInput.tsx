import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera, Search, X } from 'lucide-react';

import { BarcodeScanner } from '@/components/BarcodeScanner';
import { useFinePointer } from '@/shared/hooks/useMediaQuery';

interface SaleBarcodeInputProps {
  loading: boolean;
  onSubmitBarcode: (barcode: string) => void | Promise<void>;
}

export function SaleBarcodeInput({ loading, onSubmitBarcode }: SaleBarcodeInputProps) {
  const finePointer = useFinePointer();
  const [barcode, setBarcode] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedBarcode = barcode.trim();

    if (!normalizedBarcode || loading) {
      return;
    }

    await onSubmitBarcode(normalizedBarcode);
  }

  // Continuous scanning: the camera stays open and each reading adds an item. Readings are processed one
  // at a time so a second label seen while the first lookup is still running is not lost or interleaved.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const onSubmitRef = useRef(onSubmitBarcode);

  useEffect(() => {
    onSubmitRef.current = onSubmitBarcode;
  }, [onSubmitBarcode]);

  function handleBarcodeRead(code: string) {
    const normalizedBarcode = code.trim();

    if (!normalizedBarcode) {
      return;
    }

    queueRef.current = queueRef.current
      .then(() => onSubmitRef.current(normalizedBarcode))
      .catch(() => {
        // The page handler reports its own errors; a failed reading must not block the next ones.
      });
  }

  return (
    <section className="rounded-xl border bg-surface p-5 shadow sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold">Lançamento de produtos</h2>

        <p className="mt-1 text-sm text-muted">Digite ou escaneie o código de barras da variante.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />

          <input
            autoFocus={finePointer}
            value={barcode}
            onChange={(event) => setBarcode(event.target.value)}
            placeholder="Código de barras"
            aria-label="Código de barras do produto"
            autoComplete="off"
            disabled={loading}
            className="w-full rounded-lg border border-input bg-surface py-3 pl-10 pr-3 text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:bg-surface-muted"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !barcode.trim()}
          className="rounded-lg bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted"
        >
          {loading ? 'Consultando...' : 'Adicionar'}
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => setScannerOpen(true)}
          className="flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium hover:bg-surface-muted disabled:opacity-50"
        >
          <Camera size={18} />
          Escanear
        </button>
      </form>

      {scannerOpen && (
        <div className="mt-5 rounded-lg border p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-medium">Leitura do código de barras</p>

            <button type="button" aria-label="Fechar câmera" onClick={() => setScannerOpen(false)} className="rounded-lg p-2 hover:bg-surface-muted">
              <X size={18} />
            </button>
          </div>

          <BarcodeScanner continuous onDetected={handleBarcodeRead} />

          <button type="button" onClick={() => setScannerOpen(false)} className="mt-3 text-sm text-danger hover:underline">
            Terminar leitura
          </button>
        </div>
      )}
    </section>
  );
}
