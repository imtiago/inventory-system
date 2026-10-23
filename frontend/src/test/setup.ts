import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { server } from './server';
import { loginAs } from './auth';

// Páginas grandes (pedido de compra, venda) com userEvent ficam lentas sob carga
// (CI com poucos núcleos); o padrão de 1 s do findBy* gera falsos negativos.
configure({ asyncUtilTimeout: 4000 });

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
// Default session is ADMIN so page tests see every action; auth tests override it.
beforeEach(() => loginAs('ADMIN'));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
