# TransactionManager — Design

**Data:** 2026-10-22
**Status:** aprovado em conversa, aguardando revisão da spec

## Problema

O backend tem duas interfaces `TransactionManager` (`shared/domain` e
`shared/application/transaction`) e duas implementações
`PrismaTransactionManager` (`shared/infrastructure/prisma` e
`shared/infrastructure/database/prisma`). Os use cases abrem uma transação via
`TransactionalUseCase`, mas os repositórios usam o client `prisma` global e a
maioria dos use cases não repassa o `tx`. Resultado: a transação é aberta e
fica vazia — nenhuma operação de escrita é atômica.

Além disso, `Prisma.TransactionClient` aparece na camada de aplicação e em
interfaces de domínio, acoplando essas camadas ao ORM.

## Objetivos

1. Operações de um use case transacional são atômicas (tudo ou nada).
2. Use cases transacionais chamados dentro de outro participam da mesma
   transação.
3. Domínio e aplicação não referenciam o Prisma. Trocar de ORM exige mudar
   apenas a infraestrutura.

## Fora de escopo

- Módulos `purchases` e `nfe-import` (não funcionam hoje; serão tratados à parte).
- Métodos inexistentes nos repositórios do inventory (`save`, `findByVariant`)
  e demais bugs funcionais apontados na revisão da camada de aplicação.
- Controle de concorrência de estoque (`SELECT ... FOR UPDATE` / versão otimista).

## Abordagem

Unit of Work com contexto implícito via `AsyncLocalStorage` (equivalente Node
do `@Transactional` do Spring / `@nestjs-cls/transactional`).

### Contrato (camada de aplicação)

`src/shared/application/transaction/TransactionManager.ts` — única interface:

```ts
export interface TransactionManager {
  execute<T>(work: () => Promise<T>): Promise<T>;
}
```

`src/shared/domain/TransactionManager.ts` é removido; todos os imports passam a
apontar para o arquivo acima.

### TransactionalUseCase

```ts
export abstract class TransactionalUseCase<Req, Res> implements UseCase<Req, Res> {
  constructor(protected readonly transactionManager: TransactionManager) {}

  execute(request: Req): Promise<Res> {
    return this.transactionManager.execute(() => this.handle(request));
  }

  protected abstract handle(request: Req): Promise<Res>;
}
```

`UseCase` (`shared/domain/UseCase.ts`) perde o parâmetro de transação.

### Infraestrutura

`src/shared/infrastructure/prisma/` concentra tudo que é Prisma:

- `transactionContext.ts` — `AsyncLocalStorage<Prisma.TransactionClient>` e
  `getDb()`, que retorna o client da transação ativa ou o `prisma` global.
- `PrismaTransactionManager.ts` — se já existe transação no contexto, executa
  `work()` diretamente (reaproveita); senão, abre
  `prisma.$transaction(tx => als.run(tx, work), { timeout, maxWait })`.
  `timeout` e `maxWait` configuráveis pelo construtor; padrão 10000 ms e 2000 ms.

`src/shared/infrastructure/database/prisma/PrismaTransactionManager.ts` é removido.

### Repositórios

- Todo repositório Prisma (escrita e leitura) troca `prisma.` por `getDb().`.
- Parâmetros `tx?: Prisma.TransactionClient` saem das interfaces de domínio
  (inventory, sales, `NumberRangeRepository`) e das implementações.

### Serviços entre módulos

`InventoryService`, `FinancialService` e suas implementações perdem o
parâmetro `tx?`. A participação na transação é automática.

### Use cases

- Todos os `handle(request, tx)` passam a `handle(request)`; imports de
  `@prisma/client` saem da camada de aplicação.
- `GetInventoryDashboardUseCase` e `GetInventoryLotsByVariantIdUseCase`
  deixam de estender `TransactionalUseCase` e expõem `execute(request)`.
- `CancelSaleUseCase`: remove o `prisma.$transaction` interno e o import de
  `@shared/prisma`; o corpo roda direto no `handle`. As chamadas a
  `tx.receivable`/`tx.receivableParcel` são removidas — esses models não
  existem mais no `schema.prisma` (o código falharia em runtime). No lugar fica
  um `// TODO` indicando que o cancelamento do documento financeiro deve ser
  feito via `FinancialService` (fora de escopo).
- `ManagerCreateInventoryLotUseCase`: as chamadas a `createInventoryLotUseCase`
  e `adjustInventoryUseCase` passam a participar da transação externa
  (automático com o novo manager). Os `console.log` são removidos e a ausência
  de inventory passa a lançar erro.

## Comportamento

- **Erro:** qualquer exceção dentro de `execute` causa rollback e é
  propagada sem alteração.
- **Aninhamento:** a transação mais externa é dona do commit. Falha em qualquer
  nível desfaz tudo. Não há savepoints.
- **Regra de uso:** não capturar e ignorar erros de banco dentro de uma
  transação (no Postgres a transação fica abortada). Não disparar promises sem
  `await` dentro de `handle`. Operações lentas/externas (PDF, parsing de NF-e,
  HTTP) ficam fora de use cases transacionais.
- **NumberGenerator:** passa a rodar dentro da transação; rollback desfaz o
  incremento (sem buracos na numeração).

## Testes

Executados com o test runner nativo do Node via `tsx --test` (o setup Jest
atual não resolve os aliases `@shared/...` nem ESM).

- `InMemoryTransactionManager` (`execute = work => work()`) em
  `src/shared/application/transaction/__tests__/` ou helper de teste, para
  testes unitários de use cases.
- Teste de integração de `PrismaTransactionManager` contra o banco do
  `DATABASE_URL`:
  1. erro lançado após uma escrita → registro não existe após o `execute`;
  2. `execute` aninhado → `getDb()` retorna o mesmo client nos dois níveis e
     erro no nível interno desfaz a escrita do externo;
  3. fora de `execute`, `getDb()` retorna o client global.
- Critério de aceite adicional: `tsc --noEmit` não apresenta nenhum erro novo
  e não há mais erros relacionados a `TransactionClient`/`TransactionManager`.
- Script `"test"` do `package.json` atualizado para o novo runner.
