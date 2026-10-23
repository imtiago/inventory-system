# Fase 4A — Segurança e permissões Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o cadastro público, endurecer a autenticação, aplicar a matriz de permissões aprovada no back e no front e dar ao admin uma tela de usuários.

**Architecture:** Permissões nomeadas com mapa papel→permissões (espelhado no front); `authenticate` valida o JWT com opções estritas e confere o usuário no banco a cada requisição; `authorize(permission)` em todas as rotas; frontend gera menu e guarda rotas pela permissão.

**Tech Stack:** Fastify 5, Prisma 6, Zod 4, jsonwebtoken, bcryptjs, `node:test`; React 19, TanStack Query 5, zustand, react-hook-form, Vitest + MSW.

**Spec:** `docs/superpowers/specs/2026-10-23-phase4a-auth-design.md`

## Global Constraints

- Branch `feat/phase4a-auth`; `git add` com caminhos explícitos.
- Matriz de permissões e mapeamento de rotas exatamente como na spec.
- Mensagens PT; códigos novos: `TOO_MANY_ATTEMPTS` (429), `CANNOT_CHANGE_OWN_ACCESS` (409), `LAST_ADMIN` (409), `INVALID_CURRENT_PASSWORD` (422), `USER_NOT_FOUND` (já existe?). Erros pelas classes de `@shared/domain/errors` (criar `TooManyRequestsError` 429 se não existir, mapeado no handler).
- Única rota pública: `POST /auth/login`.
- Migration aditiva + `UPDATE` de normalização de e-mail; procedimento `migrate diff` → SQL à mão → `migrate deploy` → `generate`; nunca reset.
- Testes paralelos: usuários de teste `tx-test-<uuid>@example.com` criados e removidos pelo próprio teste (desativar não basta para limpeza: apagar por id quando não houver FKs; se houver, deixar inativo e com prefixo); nunca alterar o usuário `tx-test-inventory@local` nem usuários reais; o limitador de tentativas deve ser isolável nos testes (instância injetável/reset).
- Nenhuma dependência nova.
- tsc backend ≤ 134; frontend `tsc -b` ≤ 30.
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Usuário desativado com token ainda válido perde acesso imediatamente (401 na próxima requisição) — teste em Task 1.
2. Admin não consegue se trancar fora (desativar a si mesmo / remover último admin) — teste em Task 2.
3. ESTOQUISTA consegue abrir `/users/me`, catálogo e estoque, e recebe 403 em vendas/financeiro/clientes — teste em Task 2.
4. Falha de login com e-mail em caixa diferente conta para o mesmo limitador — teste em Task 1.
5. Após logout, outro usuário que entra não vê dados em cache do anterior — teste em Task 3.

---

### Task 1: Autenticação endurecida, login e script de admin

**Files:**
- Modify: `backend/prisma/schema.prisma` (`User.active`) + migration `<timestamp>_user_active_email_normalized` (inclui `UPDATE users SET email = lower(trim(email))`)
- Modify: `backend/src/shared/middleware/auth.ts`, `backend/src/modules/auth/infrastructure/security/JwtTokenService.ts` (8h; issuer/audience exportados como constantes), `AuthenticateUserUseCase.ts` (normalização, tempo constante, inativo, resposta com user), `CreateUserUseCase.ts` (normalização, sem `code`), login controller/schema, `backend/src/shared/domain/errors` (`TooManyRequestsError`), `errorHandler.ts` (429)
- Create: `backend/src/modules/auth/infrastructure/security/LoginAttemptLimiter.ts` (em memória, janela 15 min, 10 falhas, chave IP+e-mail normalizado, `reset()` para testes), `backend/src/scripts/createAdmin.ts` + script `create-admin` no `package.json`, seção no `backend/README.md` (criar se não existir)
- Test: `backend/src/shared/middleware/__tests__/authenticate.test.ts`, `backend/src/modules/auth/infrastructure/http/__tests__/login.test.ts`, `backend/src/scripts/__tests__/createAdmin.test.ts`

**Interfaces:**
- Produces: `request.user = { sub, role }` com papel do banco; login `200 { data: { token, user } }`.

- [ ] **Step 1: Testes (falhando)**
```ts
test("Authorization sem 'Bearer ' → 401")
test("token com issuer/audience errados → 401")
test("usuário desativado com token válido → 401 'Sessão inválida.'")            // Review Focus 1
test("usuário apagado com token válido → 401 (não 500)")
test("papel vem do banco: token com role ADMIN de um VENDEDOR não dá acesso de admin")
test("login normaliza e-mail (' Admin@X.com ' entra)")
test("login inexistente e inativo → 401 INVALID_CREDENTIALS idênticos")
test("11ª falha no mesmo IP+e-mail → 429 TOO_MANY_ATTEMPTS; caixa diferente conta junto") // Review Focus 4
test("login com sucesso zera o contador e retorna { token, user }")
test("create-admin cria e é idempotente (promove/redefine)")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar + migration.** - [ ] **Step 4: PASS + `npm test`.**
- [ ] **Step 5: Commit** — `feat(auth): strict JWT verification, DB-checked sessions, hardened login and create-admin script`

---

### Task 2: Matriz de permissões e gestão de usuários

**Files:**
- Create: `backend/src/shared/auth/permissions.ts`
- Modify: `backend/src/shared/middleware/authorize.ts` (`authorize(permission)`), todas as rotas (88 usos) conforme o mapeamento da spec; `backend/src/app.ts` (apenas `/auth/login` público)
- Create/Modify: use cases e rotas de usuários da spec (`POST/GET/GET:id/PATCH /users`, `POST /users/:id/password`, `GET /users/me`, `PUT /users/me/password`), DTO `UserDTO`
- Test: `backend/src/shared/auth/__tests__/permissions.test.ts` (matriz table-driven por HTTP), `backend/src/modules/auth/infrastructure/http/__tests__/users.test.ts`

- [ ] **Step 1: Testes (falhando)**
```ts
test("matriz: para cada papel × rota representativa de cada permissão → 2xx ou 403 conforme a spec") // Review Focus 3
test("POST /users sem token → 401; VENDEDOR → 403; ADMIN cria com papel ESTOQUISTA")
test("GET /users busca e pagina; só admin")
test("PATCH /users/:id muda papel/ativo; admin não desativa a si → 409 CANNOT_CHANGE_OWN_ACCESS")  // Review Focus 2
test("não deixar o sistema sem admin ativo → 409 LAST_ADMIN")
test("POST /users/:id/password redefine; login com a nova funciona")
test("PUT /users/me/password com atual errada → 422 INVALID_CURRENT_PASSWORD; certa → 204")
test("ESTOQUISTA acessa GET /users/me")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: PASS + `npm test` 3×; tsc ≤ 134.**
- [ ] **Step 5: Commit** — `feat(auth): permission matrix on all routes and user management`

---

### Task 3: Frontend — sessão, login, menu e guardas por permissão

**Files:**
- Create: `frontend/src/shared/auth/permissions.ts` (`Permission`, `ROLE_PERMISSIONS`, `can(role, p)`), `frontend/src/shared/auth/useCan.ts`, página 403
- Modify: `frontend/src/modules/auth/pages/Login.tsx`, `frontend/src/shared/store/auth.ts` (token + user), `frontend/src/shared/hooks/useAuth.ts`, `frontend/src/shared/services/api.ts` (401), `frontend/src/routes/{types.ts,RouteGuard.tsx,AppRoutes.tsx}`, configs de rotas dos módulos (`permission`, `showInMenu`, `label`, `icon`), `frontend/src/components/Sidebar.tsx` (menu gerado e filtrado; logout com `queryClient.clear()`), botões condicionais (excluir produto/variante, cancelar venda, estornar, ações de estoque)
- Test: `frontend/src/modules/auth/pages/__tests__/Login.test.tsx`, `frontend/src/routes/__tests__/RouteGuard.test.tsx`, `frontend/src/components/__tests__/Sidebar.test.tsx`

- [ ] **Step 1: Testes (falhando)**
```tsx
test("login envia o que o usuário digita; Enter envia; 401 mostra 'E-mail ou senha inválidos.' sem recarregar")
test("429 mostra a mensagem do backend")
test("menu: ADMIN vê tudo; VENDEDOR sem Usuários; ESTOQUISTA sem Vendas/Clientes/Financeiro")
test("rota sem permissão → página 403")
test("logout limpa o cache: próximo usuário não vê dados do anterior")              // Review Focus 5
test("botão excluir produto oculto para VENDEDOR; estornar oculto para VENDEDOR")
test("401 em outra rota → /login?expired=1 com 'Sua sessão expirou.'")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.** - [ ] **Step 4: PASS; tsc ≤ 30.**
- [ ] **Step 5: Commit** — `feat(frontend): real login, permission-based menu and route guards`

---

### Task 4: Frontend — tela de usuários e alterar senha

**Files:**
- Create: `frontend/src/modules/users/{routes.tsx,types.ts,services/userService.ts,hooks/*,pages/UserListPage.tsx,components/{UserFormModal,ResetPasswordModal}.tsx}`, `frontend/src/modules/auth/components/ChangePasswordModal.tsx`
- Modify: rotas, Sidebar (menu do usuário com "Alterar senha")
- Test: `frontend/src/modules/users/pages/__tests__/UserListPage.test.tsx`, `frontend/src/modules/auth/components/__tests__/ChangePasswordModal.test.tsx`

- [ ] **Step 1: Testes (falhando)**
```tsx
test("lista usuários com busca; criar envia { name, email, password, role }")
test("editar muda papel e ativo; 409 LAST_ADMIN/CANNOT_CHANGE_OWN_ACCESS mostra a mensagem")
test("redefinir senha envia POST /users/:id/password")
test("alterar a própria senha: 422 INVALID_CURRENT_PASSWORD no campo atual")
```
- [ ] **Step 2: Ver falhar.** - [ ] **Step 3: Implementar.**
- [ ] **Step 4: Aceite** — `npm test`; `tsc -b` ≤ 30; `vite build`.
- [ ] **Step 5: Commit** — `feat(frontend): user management and change password`
