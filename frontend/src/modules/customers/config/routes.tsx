import { CustomerDetailsPage } from '../pages/CustomerDetailsPage';
import { CustomerListPage } from '../pages/CustomerListPage';
// import { ProductEditPage } from '../pages/ProductEditPage';
// import { ProductDetailsPage } from '../pages/ProductDetailsPage';

import type { AppRoute } from '@/routes/types';
// import { ProductCreatePage } from '../pages/ProductCreatePage';
// import { VariantCreatePage } from '../pages/VariantCreatePage';
// import { VariantEditPage } from '../pages/VariantEditPage';

export const customersRoutes: AppRoute[] = [
  {
    path: '/customers',
    label: 'Clientes',
    component: CustomerListPage,
    guard: 'auth',
  },
  {
    path: '/customers/:id',
    label: 'Detalhes do Cliente',
    component: CustomerDetailsPage,
    guard: 'auth',
  },
  // {
  //   path: '/products/:id/variants/new',
  //   label: 'Nova Variante',
  //   component: VariantCreatePage,
  //   guard: 'auth',
  // },
  // {
  //   label: 'Editar Variante',
  //   path: '/variants/:variantId/edit',
  //   component: VariantEditPage,
  //   guard: 'auth',
  // },
  // {
  //   path: '/customers/new',
  //   label: 'Novo Cliente',
  //   component: ProductCreatePage,
  //   guard: 'auth',
  // },
  // {
  //   path: '/products/:id/edit',
  //   label: 'Editar Produto',
  //   component: ProductEditPage,
  //   guard: 'auth',
  // },
];
