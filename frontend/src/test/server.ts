import { setupServer } from 'msw/node';
import { inventoryHandlers } from './handlers/inventory';
import { salesHandlers } from './handlers/sales';

export const server = setupServer(...inventoryHandlers, ...salesHandlers);
