# Fase 5 — Tipos zerados e CI

**Data:** 2026-10-23
**Status:** decidido (usuário aprovou a recomendação: "pode seguir sim")

## Problema
- Backend roda via `tsx` sem checagem de tipos: 52 erros de `tsc --noEmit`. Concentrados em código sem rota: camada de aplicação de `purchases` (~30), contas a pagar (`Payable*`, rotas não registradas), `PrismaReceivableRepository`/`ReceivableRepository` legados, `UserMapper`, seed de clientes.
- Frontend: 10 erros de `tsc -b` (`components/ui/table.tsx`, `SaleCreatePage.tsx`); `eslint .` com 14 problemas (13 erros, 1 aviso).
- Sem CI: nada impede regressão de testes, tipos ou build.
- Suíte do backend nunca rodou num banco vazio: depende de dados criados no dev (ex.: faixas de numeração `NumberRange` vêm do seed).

## Decisões
1. **Código sem rota e quebrado é removido, não remendado** (o git guarda o histórico):
   - camada `application` de `purchases` e tudo de contas a pagar (`Payable*`: domínio, repositórios, use cases, controllers, rotas) que não está registrado no `app.ts`;
   - repositórios/mappers legados de recebíveis não usados pela 3B.
   O domínio de `purchases` (entidades) fica se compilar e não depender do que for removido; senão sai também. A fase de compras/contas a pagar reescreve essas partes sobre o padrão atual.
   Antes de remover, confirmar por `grep` que nada registrado/importado em tempo de execução usa o arquivo.
2. **Código vivo é corrigido de verdade** (sem `any`, `@ts-ignore` ou `as unknown as`): `UserMapper`, seed de clientes (telefone só dígitos e `code` gerado), `table.tsx`, `SaleCreatePage.tsx`, erros de lint.
3. **Scripts:** backend `typecheck` (`tsc --noEmit`); frontend `typecheck` (`tsc -b`) e `lint` já existe.
4. **Banco vazio:** a suíte do backend deve passar num banco recém-migrado sem seed. Onde um teste/caso de uso depende de dado de referência (ex.: `NumberRange`), o gerador cria a faixa sob demanda (upsert atômico) ou o setup de teste a garante — escolher a opção que também evita falha em produção com banco novo (preferir gerador criando sob demanda).
5. **CI (GitHub Actions)** `.github/workflows/ci.yml`, em `push` e `pull_request`:
   - job `backend`: Node 22, serviço `postgres:16`, `npm ci`, `prisma migrate deploy`, `prisma generate`, `npm run typecheck`, `npm test`; `JWT_SECRET` e `DATABASE_URL` definidos no workflow (valores de CI, não segredos reais);
   - job `frontend`: Node 22, `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npx vite build`;
   - cache de `npm` por `package-lock.json`.
6. Documentar no `README.md` da raiz (criar se não existir): como rodar back/front, testes, `create-admin`, e o que o CI exige.

## Aceite
Backend `tsc --noEmit` = 0, `npm test` verde 3× no banco de dev **e** 1× num banco vazio recém-migrado (criado e removido localmente para a verificação); frontend `tsc -b` = 0, `eslint .` = 0 erros, `npm test`, `vite build`; workflow válido (sintaxe verificada com `actionlint` se disponível via npx/docker, senão revisão manual) e, após o push, a primeira execução no GitHub verde.
