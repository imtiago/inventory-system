import { Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';

import type { DataTableColumn } from '@/shared/components/table';
import { CrudBadge } from '@/shared/components/crud';

import type { ICustomer } from '../types';
// import { useDeleteProduct } from './useDeleteProduct';

export function useCustomerColumns(): DataTableColumn<ICustomer>[] {
  // const deleteProduct = useDeleteProduct();

  return [
    // {
    //   id: 'id',
    //   header: 'Id',

    //   cell: (data) => data.id,
    // },

    {
      id: 'name',
      header: 'Nome',

      cell: (data) => (
        <div>
          <Link to={`/products/${data.id}`} className="font-medium hover:underline">
            {data.name}
          </Link>

          <div className="text-sm text-gray-500">{data.description}</div>
        </div>
      ),
    },

    {
      id: 'phone',
      header: 'Telefone',

      cell: (data) => data.phone,
    },
    {
      id: 'email',
      header: 'E-mail',

      cell: (data) => data.email,
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

    // {
    //   id: 'actions',
    //   header: 'Ações',
    //   align: 'center',

    //   cell: (product) => (
    //     <div className="flex justify-center gap-3">
    //       <Link to={`/products/${product.id}/edit`} className="text-blue-600 hover:text-blue-800">
    //         <Pencil size={18} />
    //       </Link>

    //       <button className="text-red-600 hover:text-red-800" onClick={() => deleteProduct.mutate(product.id)}>
    //         <Trash2 size={18} />
    //       </button>
    //     </div>
    //   ),
    // },
  ];
}
