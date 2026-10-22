import axios from 'axios';

export type ApiError = {
  status: number | null;
  code: string;
  message: string;
  fieldErrors: Record<string, string>;
};

const NETWORK_MESSAGE = 'Não foi possível conectar ao servidor.';
const UNKNOWN_MESSAGE = 'Erro inesperado.';

function unknownError(status: number | null): ApiError {
  return { status, code: 'UNKNOWN_ERROR', message: UNKNOWN_MESSAGE, fieldErrors: {} };
}

function fromBody(status: number | null, body: unknown): ApiError {
  if (typeof body !== 'object' || body === null) return unknownError(status);

  const { message, code, errors } = body as { message?: unknown; code?: unknown; errors?: unknown };

  if (typeof message !== 'string' || !message.trim() || typeof code !== 'string' || !code) {
    return unknownError(status);
  }

  const fieldErrors: Record<string, string> = {};

  if (Array.isArray(errors)) {
    for (const item of errors) {
      const entry = item as { field?: unknown; message?: unknown } | null;

      if (typeof entry?.field === 'string' && typeof entry.message === 'string' && !(entry.field in fieldErrors)) {
        fieldErrors[entry.field] = entry.message;
      }
    }
  }

  return { status, code, message, fieldErrors };
}

function classify(error: unknown): { status: number | null; body: unknown } | ApiError {
  if (!axios.isAxiosError(error)) return unknownError(null);

  if (!error.response) {
    return { status: null, code: 'NETWORK_ERROR', message: NETWORK_MESSAGE, fieldErrors: {} };
  }

  return { status: error.response.status, body: error.response.data };
}

function isApiError(value: { status: number | null; body: unknown } | ApiError): value is ApiError {
  return 'code' in value;
}

/** Normalizes any thrown value into an ApiError; reads Blob bodies (responseType "blob"). */
export async function parseApiError(error: unknown): Promise<ApiError> {
  const result = classify(error);

  if (isApiError(result)) return result;

  let { body } = result;

  if (body instanceof Blob) {
    try {
      body = JSON.parse(await body.text());
    } catch {
      return unknownError(result.status);
    }
  }

  return fromBody(result.status, body);
}

/** Synchronous variant (no Blob support), safe to use during render. */
export function parseApiErrorSync(error: unknown): ApiError {
  const result = classify(error);

  if (isApiError(result)) return result;

  return fromBody(result.status, result.body);
}
