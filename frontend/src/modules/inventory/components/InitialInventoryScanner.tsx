import { useState, type FormEvent } from 'react';
import { Camera } from 'lucide-react';

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
    <div className="space-y-5 rounded-xl bg-surface p-6 shadow">
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
            className="min-w-0 flex-1 rounded-lg border border-input bg-surface text-foreground p-3 disabled:bg-surface-muted"
            placeholder="Digite, use o leitor ou escaneie o produto"
          />

          <button type="submit" disabled={loading || !value.trim()} className="min-h-11 rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-50">
            Buscar
          </button>

          <button type="button" onClick={onOpenScanner} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-50">
            <Camera size={18} aria-hidden="true" />
            Ler
          </button>
        </div>
      </form>

      {scannerOpen && (
        <div className="rounded-lg border p-4">
          <BarcodeScanner onDetected={onBarcodeRead} />

          <button type="button" onClick={onCloseScanner} className="mt-3 text-danger">
            Cancelar leitura
          </button>
        </div>
      )}
    </div>
  );
}
