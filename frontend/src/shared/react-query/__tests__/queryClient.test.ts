import { describe, expect, test } from 'vitest';
import { AxiosError, AxiosHeaders, type AxiosResponse } from 'axios';

import { shouldRetryQuery } from '../queryClient';

function httpError(status: number) {
  const config = { headers: new AxiosHeaders() };
  const response = { status, data: {}, statusText: '', headers: {}, config } as AxiosResponse;
  return new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, response);
}

describe('shouldRetryQuery', () => {
  test.each([400, 401, 403, 404, 409, 422])('não repete %i', (status) => {
    expect(shouldRetryQuery(0, httpError(status))).toBe(false);
  });

  test('repete 5xx e erro de rede até 3 vezes', () => {
    const network = new AxiosError('Network Error', 'ERR_NETWORK');
    for (const error of [httpError(500), httpError(503), network, new Error('x')]) {
      expect(shouldRetryQuery(0, error)).toBe(true);
      expect(shouldRetryQuery(2, error)).toBe(true);
      expect(shouldRetryQuery(3, error)).toBe(false);
    }
  });
});
