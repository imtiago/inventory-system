import { useState } from 'react';

import { api } from '@/shared/services/api';
import { parseApiError } from '@/shared/services/parseApiError';
import type { MutationResult } from '../utils/apiErrorMessage';

const FALLBACK = 'Não foi possível gerar as etiquetas.';

/** With responseType "blob" the error body arrives as a Blob; parseApiError reads it. */
async function labelErrorMessage(error: unknown): Promise<string> {
  const parsed = await parseApiError(error);

  return parsed.code === 'UNKNOWN_ERROR' ? FALLBACK : parsed.message;
}

/**
 * Hands the PDF to the user as a downloaded file; call it from a direct user click (iOS/Safari ignore
 * downloads started later, e.g. after an await). Unlike window.open, a download is not subject to pop-up
 * blocking. Throws if the browser refuses.
 *
 * The link is attached to the DOM for the click and the object URL is revoked only after 60 s, so slow
 * viewers (iOS opens the PDF in a new view) can still read the blob.
 */
export function downloadPdf(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
    }
  } finally {
    setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  }
}

export function pdfFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: 'application/pdf' });
}

/** True when the device can share files (Web Share Level 2): opens AirPrint / printer apps on iOS and Android. */
export function canSharePdf(file: File): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
}

/** Shares the PDF; resolves quietly when the user dismisses the share sheet. */
export async function sharePdf(file: File, title: string): Promise<void> {
  try {
    await navigator.share({ files: [file], title });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    throw error;
  }
}

export function useGenerateInventoryProductLabels() {
  const [loading, setLoading] = useState(false);

  /** Only requests the PDF; delivering it is the caller's job (after checking it is still wanted). */
  async function generate(boxCode: string, productCode: string, quantity: number): Promise<MutationResult<Blob>> {
    try {
      setLoading(true);

      const response = await api.post(
        `/inventory/boxes/code/${encodeURIComponent(boxCode)}/product-labels`,
        { productCode, quantity },
        { responseType: 'blob' },
      );

      return { ok: true, data: new Blob([response.data], { type: 'application/pdf' }) };
    } catch (err: unknown) {
      return { ok: false, error: await labelErrorMessage(err) };
    } finally {
      setLoading(false);
    }
  }

  return {
    generate,
    loading,
  };
}
