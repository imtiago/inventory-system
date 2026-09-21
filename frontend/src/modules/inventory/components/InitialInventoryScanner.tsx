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
  return (
    <div className="space-y-5 rounded-xl bg-white p-6 shadow">
      <div>
        <label className="mb-1 block">Código de barras</label>

        <div className="flex gap-3">
          <input value={barcode} readOnly className="flex-1 rounded-lg border bg-gray-50 p-3" placeholder="Escaneie o produto" />

          <button type="button" onClick={onOpenScanner} disabled={loading} className="rounded-lg bg-gray-900 px-4 text-white disabled:opacity-50">
            📷 Ler
          </button>
        </div>
      </div>

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
