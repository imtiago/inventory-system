# Onda 7 — Regras de negócio decididas e NF-e

**Data:** 2026-10-26

**Status:** decidido. O usuário aprovou as 6 recomendações ("ok! pode seguir").

**Achados de origem:** `docs/reviews/2026-10-25-revisao-geral.md`.

## 1. Preço de venda só pelo administrador
- Nova permissão `catalog.price`, concedida apenas a ADMIN (backend `permissions.ts` e espelho no frontend).
- Quem tem `catalog.write` sem `catalog.price` continua criando e editando produtos, variantes, marcas e categorias. Ao editar uma variante, o envio de `salePrice` diferente do atual é recusado:
  - 403 `FORBIDDEN`;
  - mensagem: "Somente o administrador pode alterar o preço de venda."
- Ao criar uma variante sem `catalog.price`, o preço é obrigatório. O cadastro inicial do preço é permitido.
  - **Ruling:** sem preço inicial o produto fica "vendável a R$ 0,00" — custo se errado: vendedor define o preço inicial.
- Frontend: o campo de preço fica somente leitura na edição para quem não tem `catalog.price`. A dica é "Somente o administrador altera o preço".
- Testes de permissão (`routeGate` e a matriz HTTP) atualizados.

## 2. CPF/CNPJ do cliente
- Campo `document` opcional em `Customer`. Guarda só os dígitos, aceitando também o CNPJ alfanumérico como no fornecedor, e passa pelo mesmo validador de dígitos verificadores usado no fornecedor.
- Índice único parcial `WHERE document IS NOT NULL`, criado por migration.
- Duplicado → 409 `CUSTOMER_DOCUMENT_EXISTS`, "Já existe cliente com este CPF/CNPJ." O P2002 da corrida é traduzido para o mesmo erro.
- Busca de clientes por documento. Formulário com máscara CPF/CNPJ e mensagens no campo. Detalhe e lista mostram o documento formatado.

## 3. NF-e aceita só compra destinada à empresa
- Nova configuração `COMPANY_CNPJ` no backend: obrigatória em produção, opcional fora dela. Se estiver definida, o CNPJ do destinatário da nota (`dest/CNPJ`) precisa ser igual a ela.
- Recusas na importação, todas 422 `NFE_NOT_ACCEPTED` com a mensagem correspondente:

  | Condição | Mensagem |
  |---|---|
  | `finNFe` ≠ 1 | "Somente NF-e normal de compra é aceita (esta é de devolução/complementar/ajuste)." |
  | `tpNF` ≠ 1 (nota de saída do emitente é a entrada da empresa) | "A nota não é uma venda do fornecedor para a empresa (tpNF=<n>)." |
  | Destinatário diferente | "A nota é destinada a outro CNPJ (<cnpj formatado>)." |
  | Sem `protNFe` | "Nota sem protocolo de autorização." |
  | `cStat` ∉ {100, 150} | "Nota não autorizada ou cancelada (situação <cStat>)." |

## 4. Desfazer importação de NF-e recebida
- Rota `POST /nfe-imports/:id/revert`:
  - exige a nova permissão `purchases.revert`, só ADMIN;
  - idempotente com `Idempotency-Key`.
- Só é permitido quando nada da nota foi usado. As duas condições abaixo são conferidas em transação, com as travas na ordem documentada:
  - cada lote criado pelo recebimento ainda tem `remainingQuantity` igual à quantidade recebida;
  - o contas a pagar da compra não tem pagamento ativo.
- Quando alguma condição falha → 409 `NFE_REVERT_BLOCKED`, com o motivo: "Itens desta nota já foram vendidos/baixados" ou "Há pagamento registrado nesta conta".
- Efeito, numa única transação:
  - **Estoque:** os lotes saem do estoque, com movimentação de saída de origem PURCHASE e nota "Estorno da NF-e <número>". As alocações em caixas são removidas e o custo médio do inventário é recalculado.
  - **Contas a pagar:** o documento é cancelado.
  - **Pedido de compra:** é cancelado.
  - **Importação:** fica com status `REVERTED`. A chave volta a poder ser importada.
- Frontend:
  - botão "Desfazer importação" no detalhe da importação, para ADMIN;
  - confirmação destrutiva com o resumo do que será desfeito;
  - motivo do bloqueio exibido quando não for possível desfazer.

## 5. Ajuste de inventário abaixo do reservado
- `AdjustInventoryUseCase`: se a contagem for menor que `reservedQuantity`, recusa:
  - 409 `ADJUST_BELOW_RESERVED`;
  - mensagem: "Há <n> unidade(s) reservada(s) para: <documentos>. Libere as reservas antes de ajustar abaixo disso."
  - Os documentos vêm da soma RESERVE − RELEASE por `originId`, que a onda 5 passou a gravar.
- A movimentação de ajuste passa a guardar o reservado anterior.

## 6. Diferença de centavos entre a NF-e e as parcelas
- Diferença de até R$ 0,05 entre a soma das duplicatas (`cobr/dup`) e o total do pedido: a última parcela é ajustada pela diferença.
- Acima disso → 422 `INSTALLMENTS_TOTAL_MISMATCH`, mostrando os dois valores.
- O rascunho (`GET /nfe-imports/:id`) devolve `totals.total`, o total do pedido e a diferença. O frontend mostra a divergência antes de confirmar.

## 7. Outros achados de NF-e (Médios)
- **`nItem` repetido, ausente ou não inteiro:** 422 `INVALID_NFE`.
- **Lote da nota com número já existente:** gera um sufixo sequencial único em vez de ficar sem lote. A validade e a fabricação da nota são mantidas, e `dVal ≥ dFab` é validado.
- **Mapeamento do fornecedor:** nunca é gravado para `supplierCode` vazio. Quando o mesmo código aparece em vários itens da nota, só é gravado se todos apontarem para a mesma variante e embalagem.

## Testes e aceite
Cada item com teste que falha antes. Aceite:
- CI verde;
- backend `npm test` 2× no banco de teste;
- frontend lint 0, typecheck 0, testes e build;
- migrations aditivas aplicadas pelo fluxo seguro, com backup antes.
