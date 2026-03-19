import { useState } from "react";
import { useProducts } from "../hooks/useProducts";
import { api } from "@/shared/services/api";

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

export function SalesPage() {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);

  const { data: products } = useProducts(search);

  async function handleCheckout() {
    try {
      const payload = {
        items: cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
      };

      await api.post("/sales", payload);

      alert("Venda realizada com sucesso!");

      setCart([]);
    } catch (error) {
      console.error(error);
      alert("Erro ao finalizar venda");
    }
  }

  function addToCart(product: any) {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);

      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
        },
      ];
    });
  }

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="p-4 flex flex-col h-screen">
      {/* Busca */}
      <input
        className="border p-3 rounded mb-3 text-lg"
        placeholder="Buscar produto..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Lista de produtos */}
      <div className="flex-1 overflow-auto">
        {products?.map((product: any) => (
          <div
            key={product.id}
            className="p-3 border-b flex justify-between items-center"
          >
            <div>
              <p className="font-semibold">{product.name}</p>
              <p className="text-sm text-gray-500">R$ {product.price}</p>
            </div>

            <button
              className="bg-black text-white px-3 py-1 rounded"
              onClick={() => addToCart(product)}
            >
              +
            </button>
          </div>
        ))}
      </div>

      {/* Carrinho */}
      <div className="border-t pt-3">
        <h2 className="font-bold mb-2">Carrinho</h2>

        {cart.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span>
              {item.quantity}x {item.name}
            </span>
            <span>R$ {item.price * item.quantity}</span>
          </div>
        ))}

        <div className="mt-3 flex justify-between font-bold text-lg">
          <span>Total</span>
          <span>R$ {total}</span>
        </div>

        <button
          className="w-full mt-3 bg-green-600 text-white p-3 rounded"
          onClick={handleCheckout}
        >
          Finalizar Venda
        </button>
      </div>
    </div>
  );
}
