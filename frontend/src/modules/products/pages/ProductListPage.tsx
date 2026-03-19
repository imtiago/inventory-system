import { useState } from "react";
import { useProducts } from "../hooks/useProducts";
import { Link } from "react-router-dom";
import { useDeleteProduct } from "../hooks/useDeleteProduct";

// UI
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

export function ProductListPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useProducts(search);
  const { mutate: deleteProduct } = useDeleteProduct();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Produtos</h1>

      <div className="flex gap-4">
        <Input
          placeholder="Buscar produto..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <Link to="/products/new">
          <Button>Novo Produto</Button>
        </Link>
      </div>

      <div className="border rounded-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={3}>Carregando...</TableCell>
              </TableRow>
            )}

            {data?.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.sku}</TableCell>

                <TableCell className="text-right space-x-2">
                  <Link to={`/products/${p.id}/edit`}>
                    <Button variant="outline">Editar</Button>
                  </Link>

                  <Button
                    variant="destructive"
                    onClick={() => deleteProduct(p.id)}
                  >
                    Excluir
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
