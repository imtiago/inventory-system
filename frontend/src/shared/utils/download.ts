import { AxiosError } from 'axios';

import { api } from '@/shared/services/api';

function filenameFromDisposition(header: unknown): string | null {
  if (typeof header !== 'string') return null;

  const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* fall through to the plain filename */
    }
  }

  const plain = /filename\s*=\s*(?:"([^"]+)"|([^;]+))/i.exec(header);
  const name = plain ? (plain[1] ?? plain[2]).trim() : '';

  return name || null;
}

/**
 * GETs a file as a blob and saves it through a temporary link. The name comes from Content-Disposition
 * (when the browser can read it; the API must expose that header for cross-origin calls), else `fallbackName`.
 * On failure the error is rethrown with its body already parsed (blob -> JSON), so parseApiError reads the message.
 */
export async function downloadFile(url: string, params: Record<string, string | number | boolean | undefined>, fallbackName: string): Promise<void> {
  const clean: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') clean[key] = value;
  }

  let response;
  try {
    response = await api.get<Blob>(url, { params: clean, responseType: 'blob' });
  } catch (error) {
    if (error instanceof AxiosError && error.response?.data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await error.response.data.text());
      } catch {
        /* not JSON: leave the blob, parseApiError falls back to the generic message */
      }
    }
    throw error;
  }

  const filename = filenameFromDisposition(response.headers['content-disposition']) ?? fallbackName;
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revogação adiada: o Safari pode iniciar o download depois do clique.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
