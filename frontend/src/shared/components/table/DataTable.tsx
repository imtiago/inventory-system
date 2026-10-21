import type { DataTableProps } from './types';

const alignment = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const;

export function DataTable<T>({ data, columns, getRowId }: DataTableProps<T>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                style={{ width: column.width }}
                className={`whitespace-nowrap border-b border-gray-200 px-5 py-4 text-xs font-semibold uppercase tracking-wide text-gray-500 ${alignment[column.align ?? 'left']} `}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {data.map((row, index) => (
            <tr key={getRowId ? getRowId(row) : index} className="bg-white transition-colors hover:bg-gray-50">
              {columns.map((column) => (
                <td key={column.id} className={`px-5 py-4 align-middle text-gray-700 ${alignment[column.align ?? 'left']} `}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}

          {data.length === 0 && (
            <tr>
              <td colSpan={Math.max(columns.length, 1)} className="px-5 py-12 text-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                    <span className="text-xl text-gray-400">—</span>
                  </div>

                  <p className="font-medium text-gray-700">Nenhum cliente encontrado</p>

                  <p className="text-sm text-gray-500">Tente novamente ou cadastre um novo cliente.</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
