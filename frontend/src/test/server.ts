import { setupServer } from 'msw/node';
import { inventoryHandlers } from './handlers/inventory';

export const server = setupServer(...inventoryHandlers);
