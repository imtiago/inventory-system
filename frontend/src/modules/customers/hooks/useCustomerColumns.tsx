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

      cell: (data) => (
        <div>
          <Link to={`/customers/${data.id}`} className="font-medium hover:underline">
            {data.code}
          </Link>

          {/* <div className="text-sm text-gray-500">{data.productVariant.code}</div> */}
        </div>
      ),
    },
    {
      id: 'name',
      header: 'Nome',

      cell: (data) => data.name,
    },

    {
      id: 'phone',
      header: 'Telefone',

      cell: (data) => formatPhone(data.phone),
    },
    {
      id: 'email',
      header: 'E-mail',

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
      align: 'center',

      cell: (data) => (
        <div className="flex justify-center gap-3">
          <Can permission="customers.write">
            <button type="button" onClick={() => onEdit(data)} className="text-blue-600 hover:text-blue-800" aria-label={`Editar ${data.name}`}>
              <Pencil size={18} />
            </button>
          </Can>

          {/* <button className="text-red-600 hover:text-red-800" onClick={() => deleteProduct.mutate(product.id)}>
            <Trash2 size={18} />
          </button> */}
        </div>
      ),
    },
  ];
}
