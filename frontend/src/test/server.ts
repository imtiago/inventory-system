import { setupServer } from 'msw/node';
import { inventoryHandlers } from './handlers/inventory';
import { salesHandlers } from './handlers/sales';
import { receivablesHandlers } from './handlers/receivables';
import { payablesHandlers } from './handlers/payables';
import { authHandlers } from './auth';
import { usersHandlers } from './handlers/users';
import { purchasesHandlers } from './handlers/purchases';
import { nfeHandlers } from './handlers/nfe';
import { dashboardHandlers } from './handlers/dashboard';

export const server = setupServer(...inventoryHandlers, ...salesHandlers, ...receivablesHandlers, ...payablesHandlers, ...authHandlers, ...usersHandlers, ...purchasesHandlers, ...nfeHandlers, ...dashboardHandlers);
