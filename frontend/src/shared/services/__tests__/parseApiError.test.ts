import { describe, expect, test } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';

import { parseApiError, parseApiErrorSync } from '../parseApiError';
import validation from '@/test/fixtures/errors/validation.json';
import notFound from '@/test/fixtures/errors/notFound.json';

function axiosError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response = { status, data, statusText: '', headers: {}, config } as AxiosResponse;
  return new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, response);
}

describe('parseApiError', () => {
  test('lê {message, code, errors}', async () => {
    const result = await parseApiError(axiosError(400, validation));

    expect(result).toEqual({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos.',
      fieldErrors: { name: 'O nome é obrigatório.' },
    });
  });

  test('lê corpo Blob JSON', async () => {
    const blob = new Blob([JSON.stringify(notFound)], { type: 'application/json' });

    const result = await parseApiError(axiosError(404, blob));

    expect(result).toMatchObject({ status: 404, code: 'PRODUCT_NOT_FOUND', message: 'Produto não encontrado.' });
  });

  test('Blob que não é JSON → UNKNOWN_ERROR', async () => {
    const result = await parseApiError(axiosError(500, new Blob(['oops'])));

    expect(result).toMatchObject({ status: 500, code: 'UNKNOWN_ERROR', message: 'Erro inesperado.' });
  });

  test('sem resposta → NETWORK_ERROR', async () => {
    const error = new AxiosError('Network Error', 'ERR_NETWORK');

    expect(await parseApiError(error)).toEqual({
      status: null,
      code: 'NETWORK_ERROR',
      message: 'Não foi possível conectar ao servidor.',
      fieldErrors: {},
    });
  });

  test('valor estranho → UNKNOWN_ERROR', async () => {
    expect(await parseApiError('boom')).toEqual({
      status: null,
      code: 'UNKNOWN_ERROR',
      message: 'Erro inesperado.',
      fieldErrors: {},
    });
  });

  test('parseApiErrorSync lê corpo padrão', () => {
    expect(parseApiErrorSync(axiosError(404, notFound))).toMatchObject({ status: 404, code: 'PRODUCT_NOT_FOUND' });
  });
});
