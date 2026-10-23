# Fase 4A — Segurança, usuários e permissões

**Data:** 2026-10-23
**Status:** decidido; matriz de permissões aprovada pelo usuário
**Depende de:** Fase 2 (erros tipados)

## Problema

- `POST /users` é público: qualquer anônimo cria conta VENDEDOR e acessa tudo; não há caminho para criar ADMIN/ESTOQUISTA.
- `authenticate` não verifica `issuer`/`audience`/`algorithms` nem o esquema `Bearer`; papel vem só do token (1 dia, sem revogação); usuário apagado → escritas com FK dão 500.
- Login: enumeração por tempo de resposta; sem limite de tentativas; e-mail não normalizado; resposta só com `{ token }`.
- Todas as rotas usam `authorize(["admin","vendedor"])`: ESTOQUISTA não acessa nada (nem `/users/me`); vendedor lista usuários.
- Frontend: login com credenciais fixas, sem `<form>`; logout não limpa o cache; 401 no login recarrega a página; menu e rotas sem filtro por papel; guards `admin`/`seller` vazios.
- Banco atual: 2 usuários (1 ADMIN real, 1 de teste), sem duplicatas de e-mail por caixa.

## Matriz de permissões (aprovada)

| Permissão | ADMIN | VENDEDOR | ESTOQUISTA |
|---|---|---|---|
| `users.manage` | ✅ | | |
| `catalog.read` | ✅ | ✅ | ✅ |
| `catalog.write` (criar/editar produto, variante, marca, categoria) | ✅ | ✅ | ✅ |
| `catalog.delete` | ✅ | | |
| `customers.read`, `customers.write` | ✅ | ✅ | |
| `sales.read`, `sales.create`, `sales.cancel` | ✅ | ✅ | |
| `inventory.read` | ✅ | ✅ | ✅ |
| `inventory.write` (receber, saída, reserva, ajuste, lotes, caixas, etiquetas, inventário inicial) | ✅ | | ✅ |
| `finance.read`, `finance.pay` | ✅ | ✅ | |
| `finance.reverse` | ✅ | | |
| `self` (`/users/me`, trocar a própria senha) | ✅ | ✅ | ✅ |

## Backend

### Banco (migration aditiva)
- `User.active Boolean @default(true)`. Desativar em vez de excluir (preserva FKs de vendas, movimentações e pagamentos).
- E-mails normalizados (`trim().toLowerCase()`) na criação e no login; migration de dados `UPDATE users SET email = lower(trim(email))` (verificado: sem conflitos).
- `User.code` gerado e descartado hoje: removida a geração (não há coluna).

### Permissões
- `backend/src/shared/auth/permissions.ts`: `Permission` (union das chaves acima), `ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]>`, `hasPermission(role, permission)`.
- `authorize(permission: Permission)` substitui `authorize(roles[])` em todas as rotas, conforme a tabela de rotas da seção "Mapeamento". Sem permissão → 403 `FORBIDDEN`.

### Autenticação
- `authenticate`: exige `Authorization: Bearer <token>` (outro esquema → 401 `UNAUTHENTICATED` "Token ausente."); `jwt.verify` com `algorithms: ["HS256"]`, `issuer`, `audience` iguais aos do `JwtTokenService`; busca o usuário no banco (`id, role, active`) a cada requisição; inexistente ou inativo → 401 "Sessão inválida." (`UNAUTHENTICATED`); `request.user = { sub, role }` com o **papel do banco**.
- Expiração do token: 8 horas.
- Login (`POST /auth/login`): e-mail normalizado; usuário inexistente ou inativo → mesma resposta 401 `INVALID_CREDENTIALS` e mesmo custo (compara com um hash fixo); limite de tentativas em memória: 10 falhas por (IP, e-mail) em 15 minutos → 429 `{ message: "Muitas tentativas. Tente novamente em alguns minutos.", code: "TOO_MANY_ATTEMPTS" }`; sucesso zera o contador. Resposta `200 { data: { token, user: { id, name, email, role } } }`.
- Senha: mínimo 8, máximo 72 caracteres.

### Usuários
| Rota | Permissão | Comportamento |
|---|---|---|
| `POST /users` | `users.manage` | `{ name, email, password, role }`; e-mail duplicado → 409 `EMAIL_ALREADY_IN_USE`; resposta `201 { data: UserDTO }` |
| `GET /users` | `users.manage` | `{ data, pagination }`, busca por nome/e-mail (`search`), `limit ≤ 100` |
| `GET /users/:id` | `users.manage` | `{ data: UserDTO }` |
| `PATCH /users/:id` | `users.manage` | `{ name?, role?, active? }`; admin não pode desativar a si mesmo nem remover o próprio papel ADMIN → 409 `CANNOT_CHANGE_OWN_ACCESS`; não pode deixar o sistema sem ADMIN ativo → 409 `LAST_ADMIN` |
| `POST /users/:id/password` | `users.manage` | `{ password }` (redefinição pelo admin) → 204 |
| `GET /users/me` | `self` | `{ data: UserDTO }` |
| `PUT /users/me/password` | `self` | `{ currentPassword, newPassword }`; atual errada → 422 `INVALID_CURRENT_PASSWORD` → 204 |

`UserDTO = { id, name, email, role, active, createdAt }`. Rotas públicas: apenas `POST /auth/login`.

### Primeiro administrador
Script `npm run create-admin` (`backend/src/scripts/createAdmin.ts`): lê `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` do ambiente; se já existe usuário com o e-mail, promove a ADMIN ativo e redefine a senha; senão cria. Documentado no README do backend.

### Mapeamento das rotas existentes
- catalog: GETs → `catalog.read`; POST/PUT de produto, variante, marca, categoria → `catalog.write`; DELETE → `catalog.delete`.
- customer: GET → `customers.read`; POST/PUT → `customers.write`.
- sales: GET → `sales.read`; POST /sales → `sales.create`; POST /sales/:id/cancel → `sales.cancel`.
- inventory: GETs → `inventory.read`; demais (POST receive/dispatch/reserve/release/adjust/initial-count/lots/boxes/items/labels; GET de etiquetas em PDF → `inventory.write`).
- finance: GET /receivables* → `finance.read`; POST payments → `finance.pay`; POST reverse → `finance.reverse`.
- nfe-import → `catalog.write`.

## Frontend

- `frontend/src/shared/auth/permissions.ts` espelha a matriz (mesmas chaves); `useCan(permission)`.
- Sessão: o login guarda `token` e `user` (do corpo da resposta) no store persistido; `useAuth` usa o store e revalida com `/users/me` em segundo plano.
- Login: `<form>` com react-hook-form (e-mail e senha obrigatórios), Enter envia, erro via `parseApiErrorSync` (401 → "E-mail ou senha inválidos.", 429 → mensagem do backend), sem credenciais fixas.
- Logout: limpa token, usuário e `queryClient.clear()`.
- Interceptor 401: não redireciona quando a requisição é `/auth/login`; nos demais limpa a sessão e o cache e vai para `/login?expired=1` (a tela mostra "Sua sessão expirou.").
- Rotas: `AppRoute.permission?: Permission`; `RouteGuard` exige login e a permissão; sem permissão → página 403 ("Você não tem acesso a esta página.").
- Menu gerado a partir das rotas com `showInMenu`, filtrado por permissão.
- Botões por permissão: excluir produto/variante (`catalog.delete`); cancelar venda (`sales.cancel`); estornar pagamento (`finance.reverse`); ações de escrita de estoque (`inventory.write`).
- Tela "Usuários" (`/users`, `users.manage`): lista com busca, criar (nome, e-mail, senha, papel), editar (nome, papel, ativo), redefinir senha.
- "Alterar senha" para o próprio usuário (menu do usuário).

## Testes e aceite

Backend: matriz table-driven (cada papel × uma rota representativa por permissão → 2xx/403); token com issuer/audience errados → 401; esquema não-Bearer → 401; usuário desativado e usuário apagado → 401 (sem 500); login normaliza e-mail; inexistente/inativo → 401 igual; 11ª falha → 429 e sucesso zera; `POST /users` sem token → 401, com vendedor → 403; regras de `PATCH /users/:id` (próprio acesso, último admin); troca de senha; script create-admin idempotente.
Frontend: login real (Enter, erro, 429); logout limpa cache; 401 no login não recarrega; menu por papel (3 papéis); rota sem permissão → 403; botões ocultos por permissão; tela de usuários (listar, criar, editar, redefinir senha); alterar senha.
Aceite: backend `npm test` 3×, tsc ≤ 134; frontend `npm test`, `tsc -b` ≤ 30, `vite build`.
