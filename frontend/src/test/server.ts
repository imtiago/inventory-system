import { setupServer } from 'msw/node';
import { inventoryHandlers } from './handlers/inventory';
import { salesHandlers } from './handlers/sales';
import { receivablesHandlers } from './handlers/receivables';
import { authHandlers } from './auth';
import { usersHandlers } from './handlers/users';
import { purchasesHandlers } from './handlers/purchases';

export const server = setupServer(...inventoryHandlers, ...salesHandlers, ...receivablesHandlers, ...authHandlers, ...usersHandlers, ...purchasesHandlers);
