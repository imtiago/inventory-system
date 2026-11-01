import { useState, type ReactNode } from 'react';
import { FileText } from 'lucide-react';

import { canSharePdf, downloadPdf, pdfFile, sharePdf } from '@/modules/inventory/hooks/useGenerateInventoryProductLabels';
import { useFinePointer } from '@/shared/hooks/useMediaQuery';
import { parseApiError } from '@/shared/services/parseApiError';

import { fetchPdf } from '../services/creditService';

interface Props {
  /** Texto do botão (também o nome acessível). */
  label: string;
  /** Rota do PDF na API. */
  url: string;
  /** Nome do arquivo salvo. */
  fileName: string;
  icon?: ReactNode;
  /** `primary` = ação principal da tela; `secondary` = contorno. */
  variant?: 'primary' | 'secondary';
  /** Nome acessível mais completo (precisa conter o texto do rótulo). */
  ariaLabel?: string;
}

const base = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50';
const variants = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  secondary: 'border border-input bg-surface text-foreground hover:bg-surface-muted',
} as const;

/**
 * Baixa um PDF gerado pela API. Com mouse, o arquivo é salvo assim que chega. No toque (celular/tablet) o
 * Safari do iPhone ignora downloads iniciados depois de uma espera: o PDF fica pronto e o usuário toca em
 * "Baixar PDF" (ou "Compartilhar", que abre a impressão/AirPrint), que parte de um clique direto.
 */
export function PdfDocumentButton({ label, url, fileName, icon, variant = 'secondary', ariaLabel }: Props) {
  const finePointer = useFinePointer();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setReady(null);

    try {
      const file = pdfFile(await fetchPdf(url), fileName);

      if (finePointer) downloadPdf(file, fileName);
      else setReady(file);
    } catch (e) {
      setError((await parseApiError(e)).message);
    } finally {
      setLoading(false);
    }
  }

  function save(file: File) {
    try {
      downloadPdf(file, fileName);
    } catch {
      setError('Não foi possível baixar o PDF.');
    }
  }

  async function share(file: File) {
    try {
      await sharePdf(file, fileName);
    } catch {
      setError('Não foi possível compartilhar o PDF.');
    }
  }

  return (
    <>
      <button type="button" onClick={generate} disabled={loading} aria-label={ariaLabel} className={`${base} ${variants[variant]}`}>
        {icon ?? <FileText size={18} aria-hidden="true" />}
        {loading ? 'Gerando PDF...' : label}
      </button>

      {ready && (
        <div className="flex basis-full flex-col gap-2 rounded-lg border border-border bg-surface-muted p-3 sm:flex-row sm:items-center">
          <p className="text-sm text-muted sm:mr-auto">PDF pronto.</p>
          <button type="button" onClick={() => save(ready)} className={`${base} ${variants.primary}`}>
            Baixar PDF
          </button>
          {canSharePdf(ready) && (
            <button type="button" onClick={() => share(ready)} className={`${base} ${variants.secondary}`}>
              Compartilhar
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="basis-full rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      )}
    </>
  );
}
