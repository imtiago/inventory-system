// src/shared/components/table/DataTable.tsx

import type { DataTableProps } from "./types";

const alignment = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

export function DataTable<T>({ data, columns, getRowId }: DataTableProps<T>) {
  return (
    <table className="w-full border-collapse">
      <thead
        className="
          sticky
          top-0
          z-10
          bg-gray-100
        "
      >
        <tr>
          {columns.map((column) => (
            <th
              key={column.id}
              style={{ width: column.width }}
              className={`
                p-4
                font-semibold
                border-b
                ${alignment[column.align ?? "left"]}
              `}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {data.map((row, index) => (
          <tr
            key={getRowId ? getRowId(row) : index}
            className="
              border-b
              hover:bg-gray-50
            "
          >
            {columns.map((column) => (
              <td
                key={column.id}
                className={`
                  p-4
                  ${alignment[column.align ?? "left"]}
                `}
              >
                {column.cell(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
