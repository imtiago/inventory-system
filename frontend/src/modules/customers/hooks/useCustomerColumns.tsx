import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';

import type { DataTableColumn } from '@/shared/components/table';

import type { ICustomer } from '../types';
import { formatPhone } from '@/shared/utils/formatPhone';
import { Can } from '@/shared/auth/Can';
// import { useDeleteProduct } from './useDeleteProduct';

export function useCustomerColumns(onEdit: (customer: ICustomer) => void): DataTableColumn<ICustomer>[] {
  // const deleteProduct = useDeleteProduct();

  return [
    // {
    //   id: 'id',
    //   header: 'Id',

    //   cell: (data) => data.id,
    // },

    {
      id: 'code',
      header: 'Código',
      mobile: 'meta',

      cell: (data) => (
        <div>
          <Link to={`/customers/${data.id}`} className="font-medium hover:underline">
            {data.code}
          </Link>

          {/* <div className="text-sm text-muted">{data.productVariant.code}</div> */}
        </div>
      ),
    },
    {
      id: 'name',
      header: 'Nome',
      mobile: 'title',

      cell: (data) => data.name,
    },

    {
      id: 'phone',
      header: 'Telefone',
      mobile: 'meta',

      cell: (data) => formatPhone(data.phone),
    },
    {
      id: 'email',
      header: 'E-mail',
      mobile: 'meta',

      cell: (data) => data.email ?? "-",
    },

    // {
    //   id: 'category',
    //   header: 'Categoria',

    //   cell: (product) => product.category.name,
    // },

    // {
    //   id: 'variants',
    //   header: 'Variantes',
    //   align: 'center',

    //   cell: (product) => <CrudBadge>{product.variantsCount}</CrudBadge>,
    // },

    {
      id: 'actions',
      header: 'Ações',
      mobile: 'actions',
      align: 'center',

      cell: (data) => (
        <div className="flex justify-center gap-1">
          <Can permission="customers.write">
            <button type="button" onClick={() => onEdit(data)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-primary hover:text-primary-hover" aria-label={`Editar ${data.name}`}>
              <Pencil size={18} />
            </button>
          </Can>

          {/* <button className="text-danger hover:text-danger/80" onClick={() => deleteProduct.mutate(product.id)}>
            <Trash2 size={18} />
          </button> */}
        </div>
      ),
    },
  ];
}
