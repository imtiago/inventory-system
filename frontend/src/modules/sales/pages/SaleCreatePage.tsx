import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Page } from '@/shared/components/layout/Page';
import { Section } from '@/shared/components/details/Section';

import { useSaleCart } from '../hooks/useSaleCart';

export function SaleCreatePage() {
  const [customerId, setCustomerId] = useState('');

  const { items, addItem, updateQuantity, removeItem, clearItems, totalQuantity, estimatedTotal } = useSaleCart();

  const formattedTotal = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(estimatedTotal);

  return (
    <Page>
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link to="/sales" aria-label="Voltar para vendas" className="mt-1 rounded-md p-2 hover:bg-gray-100">
              <ArrowLeft size={20} />
            </Link>

            <div>
              <h1 className="text-2xl font-semibold">Nova venda</h1>
              <p className="mt-1 text-sm text-gray-500">Preencha os dados e lance os produtos da venda.</p>
            </div>
          </div>
        </header>

        <Section title="Dados da venda">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Integrar aqui o SaleCustomerSelect */}
            <div>
              <label htmlFor="customer" className="mb-2 block text-sm font-medium">
                Cliente *
              </label>

              <select id="customer" value={customerId} onChange={(event) => setCustomerId(event.target.value)} className="w-full rounded-lg border bg-transparent px-3 py-2.5" required>
                <option value="">Selecione um cliente</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Vendedor</label>
              <div className="rounded-lg border bg-gray-50 px-3 py-2.5 text-sm text-gray-500">Usuário autenticado</div>
            </div>
          </div>
        </Section>

        <Section title="Lançamento de produtos">
          {/* Integrar aqui o SaleBarcodeInput */}
          <p className="text-sm text-gray-500">O campo de código de barras será integrado à busca de variantes da API nesta seção.</p>
        </Section>

        <Section title={`Itens da venda (${items.length})`}>
          {/* Integrar aqui o SaleItemsTable */}
          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="font-medium">Nenhum produto lançado</p>
              <p className="mt-1 text-sm text-gray-500">Leia ou digite o código de um produto para começar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="px-3 py-3">Produto</th>
                    <th className="px-3 py-3">Quantidade</th>
                    <th className="px-3 py-3">Preço unitário</th>
                    <th className="px-3 py-3">Subtotal</th>
                    <th className="px-3 py-3">Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => (
                    <tr key={item.productVariantId} className="border-b">
                      <td className="px-3 py-3">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-xs text-gray-500">{item.productCode}</p>
                      </td>

                      <td className="px-3 py-3">
                        <input
                          aria-label={`Quantidade de ${item.productName}`}
                          type="number"
                          min={1}
                          step={1}
                          value={item.quantity}
                          onChange={(event) => updateQuantity(item.productVariantId, Number(event.target.value))}
                          className="w-20 rounded-md border px-2 py-1.5"
                        />
                      </td>

                      <td className="px-3 py-3">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(item.unitPrice)}
                      </td>

                      <td className="px-3 py-3 font-medium">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(item.quantity * item.unitPrice)}
                      </td>

                      <td className="px-3 py-3">
                        <button type="button" onClick={() => removeItem(item.productVariantId)} className="text-red-600 hover:text-red-800">
                          Remover
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Resumo da venda">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-500">Quantidade total de unidades: {totalQuantity}</p>
              <p className="mt-1 text-sm text-gray-500">Total estimado</p>
              <p className="text-2xl font-semibold">{formattedTotal}</p>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button variant="outline" onClick={clearItems} disabled={items.length === 0}>
                Limpar itens
              </Button>

              <Button
                disabled={!customerId || items.length === 0}
                onClick={() => {
                  // Integrar a mutação de criação da venda.
                }}
              >
                Registrar venda
              </Button>
            </div>
          </div>
        </Section>
      </div>
    </Page>
  );
}
