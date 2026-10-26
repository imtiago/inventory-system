import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { server } from './server';
import { loginAs } from './auth';
import { resetViewport } from './viewport';

// Páginas grandes (pedido de compra, venda) com userEvent ficam lentas sob carga
// (CI com poucos núcleos); o padrão de 1 s do findBy* gera falsos negativos.
configure({ asyncUtilTimeout: 4000 });

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
// Default session is ADMIN so page tests see every action; auth tests override it.
beforeEach(() => loginAs('ADMIN'));
afterEach(() => {
  cleanup();
  resetViewport();
  server.resetHandlers();
});
afterAll(() => server.close());

// Guard: every covered POST (money and stock operations) must carry Idempotency-Key.
// A request without it would get 400 IDEMPOTENCY_KEY_REQUIRED in production, so any test
// (page or hook) that triggers one without the header fails here.
const COVERED_POSTS = [
  /\/sales$/,
  /\/sales\/[^/]+\/cancel$/,
  /\/(receivables|payables)\/[^/]+\/parcels\/[^/]+\/payments$/,
  /\/(receivables|payables)\/payments\/[^/]+\/reverse$/,
  /\/purchases$/,
  /\/purchases\/[^/]+\/(receipts|cancel)$/,
  /\/nfe-imports\/[^/]+\/(confirm|revert)$/,
  /\/inventory\/(receive|dispatch|adjust|reserve|release|initial-count|lots)$/,
  /\/inventory\/boxes$/,
  /\/inventory\/boxes\/[^/]+\/items$/,
  /\/inventory\/boxes\/[^/]+\/items\/remove$/,
];
const missingKey: string[] = [];

export function isCoveredPost(method: string, pathname: string): boolean {
  return method === 'POST' && COVERED_POSTS.some((re) => re.test(pathname));
}

beforeEach(() => {
  missingKey.length = 0;
});
server.events.on('request:start', ({ request }) => {
  const { pathname } = new URL(request.url);

  if (isCoveredPost(request.method, pathname) && !request.headers.get('Idempotency-Key')) {
    missingKey.push(`${request.method} ${pathname}`);
  }
});
afterEach(() => {
  if (missingKey.length) {
    const list = missingKey.join(', ');
    missingKey.length = 0;
    throw new Error(`Idempotency-Key ausente em: ${list}`);
  }
});
