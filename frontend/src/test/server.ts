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
import { pricingHandlers } from './handlers/pricing';

export const server = setupServer(...inventoryHandlers, ...salesHandlers, ...receivablesHandlers, ...payablesHandlers, ...authHandlers, ...usersHandlers, ...purchasesHandlers, ...nfeHandlers, ...dashboardHandlers, ...pricingHandlers);
