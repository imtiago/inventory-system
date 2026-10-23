import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './server';
import { loginAs } from './auth';

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
// Default session is ADMIN so page tests see every action; auth tests override it.
beforeEach(() => loginAs('ADMIN'));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
