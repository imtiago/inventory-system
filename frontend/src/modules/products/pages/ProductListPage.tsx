import { Link } from "react-router-dom";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";

export function ProductListPage() {
  const products = [
    {
      id: "1",
      name: "Notebook Dell Inspiron",
      sku: "NB-DELL-001",
      category: "Informática",
      stock: 15,
      price: 3500,
    },
    {
      id: "2",
      name: "Mouse Logitech",
      sku: "MS-LOG-002",
      category: "Periféricos",
      stock: 50,
      price: 120,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>

          <p className="text-gray-500">Gerencie seu catálogo de produtos</p>
        </div>

        <Link
          to="/products/new"
          className="
            flex items-center gap-2
            bg-black text-white
            px-4 py-2
            rounded-lg
            hover:bg-gray-800
          "
        >
          <Plus size={18} />
          Novo Produto
        </Link>
      </div>

      {/* Filtros */}
      <div
        className="
          bg-white
          rounded-xl
          shadow-sm
          p-4
          flex
          gap-4
        "
      >
        <div
          className="
          flex
          items-center
          gap-2
          border
          rounded-lg
          px-3
          flex-1
        "
        >
          <Search size={18} className="text-gray-400" />

          <input
            placeholder="Buscar produto..."
            className="
              outline-none
              w-full
              py-2
            "
          />
        </div>

        <select
          className="
            border
            rounded-lg
            px-3
          "
        >
          <option>Todas categorias</option>

          <option>Informática</option>
        </select>
      </div>

      {/* Tabela */}
      <div
        className="
          bg-white
          rounded-xl
          shadow-sm
          overflow-hidden
        "
      >
        <table
          className="
            w-full
          "
        >
          <thead
            className="
              bg-gray-100
            "
          >
            <tr>
              <th className="text-left p-4">Produto</th>

              <th className="text-left p-4">SKU</th>

              <th className="text-left p-4">Categoria</th>

              <th className="text-left p-4">Estoque</th>

              <th className="text-left p-4">Preço</th>

              <th className="text-center p-4">Ações</th>
            </tr>
          </thead>

          <tbody>
            {products.map((product) => (
              <tr
                key={product.id}
                className="
                  border-t
                  hover:bg-gray-50
                "
              >
                <td className="p-4 font-medium">{product.name}</td>

                <td className="p-4">{product.sku}</td>

                <td className="p-4">{product.category}</td>

                <td className="p-4">
                  <span
                    className="
                      px-3 py-1
                      rounded-full
                      text-sm
                      bg-green-100
                      text-green-700
                    "
                  >
                    {product.stock}
                  </span>
                </td>

                <td className="p-4">R$ {product.price.toFixed(2)}</td>

                <td
                  className="
                  p-4
                  flex
                  justify-center
                  gap-3
                "
                >
                  <Link
                    to={`/products/${product.id}/edit`}
                    className="
                      text-blue-600
                      hover:text-blue-800
                    "
                  >
                    <Pencil size={18} />
                  </Link>

                  <button
                    className="
                      text-red-600
                      hover:text-red-800
                    "
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
