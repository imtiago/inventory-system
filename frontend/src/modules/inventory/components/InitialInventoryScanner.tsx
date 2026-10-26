import { useState, type FormEvent } from 'react';

import { BarcodeScanner } from '@/components/BarcodeScanner';

interface IInitialInventoryScannerProps {
  barcode: string;
  loading: boolean;
  scannerOpen: boolean;
  onOpenScanner: () => void;
  onCloseScanner: () => void;
  onBarcodeRead: (code: string) => void;
}

export function InitialInventoryScanner({ barcode, loading, scannerOpen, onOpenScanner, onCloseScanner, onBarcodeRead }: IInitialInventoryScannerProps) {
  // What the user is typing; null while the field just mirrors the barcode of the current flow.
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? barcode;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const code = value.trim();
    if (!code || loading) return;

    setDraft(null);
    onBarcodeRead(code);
  }

  return (
    <div className="space-y-5 rounded-xl bg-white p-6 shadow">
      <form onSubmit={handleSubmit}>
        <label htmlFor="initial-inventory-barcode" className="mb-1 block">
          Código de barras
        </label>

        <div className="flex flex-wrap gap-3">
          <input
            id="initial-inventory-barcode"
            value={value}
            onChange={(event) => setDraft(event.target.value)}
            autoComplete="off"
            disabled={loading}
            className="min-w-0 flex-1 rounded-lg border p-3 disabled:bg-gray-50"
            placeholder="Digite, use o leitor ou escaneie o produto"
          />

          <button type="submit" disabled={loading || !value.trim()} className="min-h-11 rounded-lg bg-black px-4 text-white disabled:opacity-50">
            Buscar
          </button>

          <button type="button" onClick={onOpenScanner} disabled={loading} className="min-h-11 rounded-lg bg-gray-900 px-4 text-white disabled:opacity-50">
            📷 Ler
          </button>
        </div>
      </form>

      {scannerOpen && (
        <div className="rounded-lg border p-4">
          <BarcodeScanner onDetected={onBarcodeRead} />

          <button type="button" onClick={onCloseScanner} className="mt-3 text-red-600">
            Cancelar leitura
          </button>
        </div>
      )}
    </div>
  );
}
