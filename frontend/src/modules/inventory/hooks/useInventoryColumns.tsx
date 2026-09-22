import { Link } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';

import type { DataTableColumn } from '@/shared/components/table';
import { CrudBadge } from '@/shared/components/crud';

import type { IInventory } from '../types';
// import { useDeleteProduct } from './useDeleteProduct';

export function useInventoryColumns(): DataTableColumn<IInventory>[] {
  // const deleteProduct = useDeleteProduct();

  return [
    // {
    //   id: 'id',
    //   header: 'Id',

    //   cell: (data) => data.id,
    // },

    // {
    //   id: 'code',
    //   header: 'Código',

    //   cell: (data) => data.productVariant.code,
    // },
    {
      id: 'code',
      header: 'Código',

      cell: (data) => (
        <div>
          <Link to={`/inventory/${data.id}`} className="font-medium hover:underline">
            {data.productVariant.code}
          </Link>

          {/* <div className="text-sm text-gray-500">{data.productVariant.code}</div> */}
        </div>
      ),
    },
    {
      id: 'phone',
      header: 'Produto / Variante',

      cell: (data) => data.productVariant.name,
    },
    {
      id: 'quantity',
      header: 'Estoque',

      cell: (data) => <CrudBadge>{data.quantity}</CrudBadge>,
    },
    {
      id: 'availableQuantity',
      header: 'Disponível',

      cell: (data) => <CrudBadge>{data.availableQuantity}</CrudBadge>,
    },
    {
      id: 'status',
      header: 'Status',

      cell: (data) => <CrudBadge>{data.availableQuantity}</CrudBadge>,
    },

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
