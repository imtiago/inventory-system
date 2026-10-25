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
 * Hands the PDF to the user as a downloaded file. Unlike window.open after an await,
 * a download is not subject to pop-up blocking. Throws if the browser refuses.
 *
 * Known limitation (kept on purpose, no behaviour change): a browser that blocks the programmatic
 * `<a download>` click silently gives no signal to detect it, so we show no "blocked" warning
 * (it would be a false alarm for every user whose download simply started). Only a thrown error
 * reaches the caller, which then offers the failure message.
 */
export function downloadPdf(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    link.click();
  } finally {
    // Give the browser time to start reading the blob before releasing it.
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
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
