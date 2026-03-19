import React from "react";

export const ProductTable = ({ products }: { products: any[] }) => {
  return (
    <table className="w-full border border-border rounded-md">
      <thead>
        <tr>
          <th className="p-2 border-b">Nome</th>
          <th className="p-2 border-b">SKU</th>
          <th className="p-2 border-b">Marca</th>
          <th className="p-2 border-b">Categoria</th>
        </tr>
      </thead>
      <tbody>
        {products.map((p) => (
          <tr key={p.id} className="hover:bg-accent-bg">
            <td className="p-2">{p.name}</td>
            <td className="p-2">{p.sku}</td>
            <td className="p-2">{p.brand?.name || "-"}</td>
            <td className="p-2">{p.category?.name || "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
