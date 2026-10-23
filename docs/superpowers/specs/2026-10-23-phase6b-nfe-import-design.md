# Fase 6B — Importação de NF-e

**Data:** 2026-10-23
**Status:** decidido (usuário aprovou a divisão 6A/6B e delegou as decisões: "pode seguir")
**Depende de:** 6A (fornecedores, pedidos de compra, recebimento, contas a pagar)

## Problema
- `POST /nfe-import` atual não lê o layout real da NF-e (procura `nfe.products.product`), grava em repositório em memória (nada persiste), cria produtos com marca/categoria de UUIDs fixos inexistentes, sem variante e sem transação; o caminho de PDF é específico de um fornecedor (texto fixo da DANFE) e não é confiável.
- Não existe vínculo entre o código do produto no fornecedor e a variante do catálogo, nem conversão de unidade (caixa → unidades).

## Decisões
1. **Só XML da NF-e modelo 55, layout 4.00** (`nfeProc/NFe/infNFe` ou `NFe/infNFe`). PDF/DANFE deixa de ser aceito (400 `UNSUPPORTED_FILE_TYPE`, "Envie o arquivo XML da NF-e."). Assinatura digital e consulta à SEFAZ ficam fora de escopo (a chave é validada pelo dígito verificador).
2. **Fluxo em duas etapas:** enviar o XML cria um **rascunho de importação** com o conteúdo lido e sugestões de vínculo; o usuário revisa e **confirma**, e só então fornecedor/produtos/variantes/pedido/contas a pagar são criados, numa única transação.
3. **Vínculo por fornecedor:** tabela `SupplierProductMapping (supplierId, supplierCode, productVariantId, unitsPerPackage)` aprendida na confirmação e sugerida nas próximas notas do mesmo fornecedor.
4. Parcelas do contas a pagar vêm das duplicatas da nota (`cobr/dup`); sem duplicatas → parcela única com vencimento na data de emissão (o usuário pode trocar a data na revisão).

## Leitura do XML (`NfeParser`, função pura)
- Parser: `fast-xml-parser` (já instalado) com entidades desabilitadas; XML com `<!DOCTYPE` → 400 `INVALID_FILE_CONTENT` (anti-XXE); arquivo ≤ 10 MB (limite atual).
- Validações → 422 `INVALID_NFE` com mensagem específica: não é NF-e (sem `infNFe`); `mod ≠ 55`; chave (`infNFe@Id` sem "NFe") ≠ 44 dígitos ou DV inválido; sem itens; emitente sem CNPJ/CPF válido.
- `NfeDocument`:
  ```
  { accessKey, number, series, issueDate (YYYY-MM-DD, de dhEmi no fuso de Brasília),
    supplier: { document, name, tradeName, email, phone },
    totals: { products, discount, freight, insurance, other, ipi, icmsSt, total } (centavos),
    items: [{ index (nItem), supplierCode (cProd), barcode (cEAN/cEANTrib; "SEM GTIN"/vazio → null),
              name (xProd), ncm, cfop, unit (uCom), quantity (qCom, até 4 casas), unitPrice (vUnCom),
              productsTotal (vProd), discount (vDesc), freight (vFrete), insurance (vSeg), other (vOutro),
              ipi (IPI/IPITrib/vIPI), icmsSt (ICMS*/vICMSST),
              lots: [{ batchNumber (nLote), quantity (qLote), manufacturingDate (dFab), expirationDate (dVal) }] }],
    installments: [{ number (nDup), dueDate (dVenc), amount (vDup) }] }
  ```
- Custo de cada item (centavos): `productsTotal − discount + freight + insurance + other + ipi + icmsSt`. Soma dos itens deve bater com `totals.total` (vNF) com tolerância de 1 centavo por item; senão 422 `INVALID_NFE` ("Totais da nota não conferem.").

## Backend

### Banco (migration aditiva)
- `NfeImport { id, accessKey String @unique, status NfeImportStatus (DRAFT, CONFIRMED), supplierDocument, supplierName, issueDate @db.Date, totalAmount Decimal(12,2), payload Json (NfeDocument), purchaseId String? @unique (FK Purchase SetNull), createdById (FK users SetNull), confirmedById?, createdAt, confirmedAt? }`.
- `SupplierProductMapping { id, supplierId (FK Cascade), supplierCode, productVariantId (FK Restrict), unitsPerPackage Int @default(1), createdAt, updatedAt; @@unique([supplierId, supplierCode]) }`.
- `Purchase.origin = XML` para pedidos importados (enum já tem `XML`); `Purchase.nfeAccessKey`? — não: o vínculo fica em `NfeImport.purchaseId`.

### Permissões
Importar, ver, descartar e confirmar: `purchases.write` (ADMIN). Confirmar com entrada no estoque exige também `purchases.receive` (ADMIN tem).

### Rotas — `/nfe-imports`
| Rota | Comportamento |
|---|---|
| `POST /nfe-imports` (multipart, campo `file`) | Lê e valida. Chave já **confirmada** → 409 `NFE_ALREADY_IMPORTED` ("Esta NF-e já foi importada.") com `purchaseId` no corpo (`details`). Chave com rascunho existente → substitui o conteúdo do rascunho e devolve 200; senão cria → 201. Resposta `{ data: NfeImportDTO }`. |
| `GET /nfe-imports` | `page`, `limit`, `status`; ordenado por `createdAt` desc. |
| `GET /nfe-imports/:id` | 404 `NFE_IMPORT_NOT_FOUND`. |
| `DELETE /nfe-imports/:id` | só `DRAFT` (confirmado → 409 `NFE_IMPORT_CONFIRMED`) → 204. |
| `POST /nfe-imports/:id/confirm` | ver abaixo → 201 `{ data: { importId, purchaseId } }`. |

`NfeImportDTO = { id, accessKey, status, number, series, issueDate, totalAmount, purchaseId, createdAt,
  supplier: { document, name, match: { id, name } | null },
  items: [{ index, supplierCode, barcode, name, unit, quantity, unitCost (centavos→reais, custo total/quantidade), total, lots,
            suggestion: { productVariantId, label, unitsPerPackage, source: "MAPPING" | "BARCODE" } | null }],
  installments }` — sugestões calculadas na leitura (fornecedor por documento; item por mapeamento do fornecedor, senão por código de barras de variante).

### Confirmação — `POST /nfe-imports/:id/confirm`
```
{ supplier: { id } | { create: { name, email?, phone? } },      // create usa o documento da nota
  items: [{ index,
            link: { productVariantId, unitsPerPackage? (≥1, padrão 1) }
          | create: { productId? | newProduct: { name, brandId, categoryId, description? },
                      variantName, barcode? (padrão: barcode da nota), salePrice (≥0), unitsPerPackage? } }],  // todos os itens, cada um uma vez
  installments?: [{ dueDate, amount }],   // padrão: os da nota (ou parcela única na emissão); soma = total da nota
  receive: boolean }
```
Numa transação, nesta ordem:
1. Trava o rascunho (`FOR UPDATE`); não `DRAFT` → 409 `NFE_IMPORT_CONFIRMED`. Re-checa chave confirmada → 409.
2. Fornecedor: `id` existente (documento diferente do da nota → 422 `SUPPLIER_DOCUMENT_MISMATCH`) ou cria com o documento da nota (já existe → usa o existente; nunca duplica).
3. Itens: para `create`, cria produto (ou usa `productId`) e variante (barcode duplicado → 409 `BARCODE_ALREADY_EXISTS`); grava/atualiza o mapeamento `(fornecedor, supplierCode) → variante, unitsPerPackage`.
4. Quantidade em unidades = `quantity × unitsPerPackage`; não inteira → 422 `NFE_QUANTITY_NOT_INTEGER` (indicando o item). Itens com a mesma variante → somados num item de pedido só (quantidade e custos somados).
5. Pedido (`origin XML`, `purchaseDate` = emissão, observação "NF-e <número>/<série>") com cada item: `quantity` em unidades, `unitPrice = productsTotal / quantidade` (centavos, arredondado), `discount`, `freight = freight+insurance+other`, `tax = ipi+icmsSt`, de forma que o total do item = custo do item na nota (ajustar o arredondamento do `unitPrice` no `discount`/`tax` para o total bater exato). Contas a pagar com as parcelas confirmadas (soma ≠ total → 422 `INSTALLMENTS_TOTAL_MISMATCH`). Reusa os casos de uso da 6A (generalizar `createPurchasePayable` para aceitar parcelas explícitas).
6. `receive: true` → recebimento total pelo caso de uso da 6A, com lotes da nota (`rastro`) quando presentes (quantidade do lote × unitsPerPackage; lotes que não somam a quantidade do item → o restante entra sem lote).
7. Rascunho → `CONFIRMED`, `purchaseId`, `confirmedById`, `confirmedAt`.

Duas confirmações simultâneas do mesmo rascunho → uma 201, outra 409.

### Limpeza
Remover `ImportNfeUseCase`, `NfeImportRepository` em memória, `ParsePdfService`, `ParseXmlService`, `NfeItem`, rota `POST /nfe-import` e as dependências que ficarem sem uso (`xml2js`, `@cedrugs/pdf-parse`, `@types/xml2js`, `@types/pdf-parse`) — conferir uso por `grep` antes.

## Frontend
- Menu Compras → "Importar NF-e" (`purchases.write`): lista de importações (rascunhos e confirmadas, com link para o pedido) + botão "Enviar XML".
- **Revisão** (`/nfe-imports/:id`): cabeçalho (número/série, emissão, chave formatada, total), fornecedor (encontrado → mostra; não encontrado → "Será cadastrado" com nome editável), parcelas (editáveis: data e valor; soma conferida), tabela de itens:
  - sugestão encontrada → "Vincular a <variante>" pré-selecionado, com origem (mapeamento/código de barras);
  - sem sugestão → escolher "Vincular a variante existente" (busca por nome/código/código de barras) ou "Criar produto" (nome da nota pré-preenchido, marca, categoria, nome da variante, preço de venda) ou "Criar variante em produto existente";
  - "Unidades por embalagem" (padrão 1 ou do mapeamento) e quantidade resultante em unidades;
  - checkbox "Dar entrada no estoque agora" (marcado por padrão; só aparece com `purchases.receive`).
- Confirmar → navega para o detalhe do pedido. Erros exibidos uma vez; 409 `NFE_ALREADY_IMPORTED` no envio oferece link para o pedido.

## Testes e aceite
Backend: parser com XMLs de exemplo realistas em `backend/src/modules/nfe-import/__fixtures__/` (nota com 3 itens, SEM GTIN, IPI, ICMS-ST, desconto, frete, duplicatas e rastro; nota sem cobrança; nota modelo 65; chave com DV errado; XML com DOCTYPE; totais que não conferem); upload (cria rascunho, sugestões por mapeamento e por código de barras, reenvio do rascunho, chave confirmada → 409, PDF → 400); confirmação (fornecedor novo e existente, documento divergente 422, criar produto/variante, vincular, unidades por embalagem com quantidade não inteira 422, itens da mesma variante somados, total do pedido = vNF exato, parcelas da nota e editadas, soma divergente 422, com e sem entrada no estoque — lotes da nota criados —, mapeamento gravado e sugerido na próxima nota, confirmação dupla simultânea → uma 409, rollback completo quando um item falha); permissões; contrato por fixtures `frontend/src/test/fixtures/nfe/{nfeImport,nfeImportList}.json`.
Frontend: enviar XML (sucesso, 409 com link), revisão (sugestões pré-selecionadas, criar produto, unidades por embalagem, parcelas, corpo enviado na confirmação), lista, menu por papel.
Aceite: CI verde; backend `npm test` 3× local.
