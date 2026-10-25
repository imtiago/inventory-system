# Onda 2 — Telas (revisão geral 2026-10-25)

**Data:** 2026-10-25
**Status:** decidido (usuário: "pode seguir"). Achados de origem em `docs/reviews/2026-10-25-revisao-geral.md` (seções "Frontend — …"); os títulos abaixo correspondem aos títulos de lá.

## 1. Catálogo e clientes
- **Edição de variante usa cache velho (Alto):** invalidar/atualizar a chave da variante em update/delete (centralizar em `productQueryKeys.variant`); formulário de edição só renderiza com dados frescos (refetch na montagem e `reset` quando os dados mudam). Teste: editar preço, reabrir, mudar só o nome → corpo enviado só com o nome e preço exibido = novo.
- **Erros de telefone/endereço do cliente não aparecem (Alto):** exibir erro de todos os campos do formulário com `aria-invalid`/`aria-describedby`; qualquer erro de campo sem campo visível cai no alerta geral. Teste por campo.
- **Clique duplo cria duplicados (Médio):** formulários de cliente, produto, variante, marca/categoria, fornecedor e usuário desabilitam o envio durante a mutação e ignoram reenvio enquanto `isPending`. Teste: dois cliques → uma requisição.
- **Detalhe do produto:** erro na lista de variantes mostra mensagem e "Tentar novamente"; remover cards de placeholder sem dados reais.
- **Dropdowns truncados em 100 (Médio):** marca e categoria no formulário de produto e nos filtros viram campo com busca (autocomplete existente do projeto, consulta `?search=` com debounce), mantendo o valor atual visível.
- **Variante criada no assistente sem preço:** usar o serviço compartilhado de variantes e exigir preço de venda (≥ 0, 2 casas) no assistente.

## 2. Estoque
- **Assistente — "Voltar"/troca de caixa durante "Adicionar à caixa" perde o resultado:** bloquear navegação/troca enquanto a operação está em andamento e aplicar o resultado quando ela termina (sem perder o que já foi gravado).
- **Etiquetas com `window.open` após `await`:** abrir a janela de forma síncrona no clique (ou baixar o PDF como arquivo); se o navegador bloquear, mostrar aviso e não concluir o passo como se tivesse impresso.
- **Busca de produtos fora de ordem:** descartar respostas antigas (chave de query com o termo ou contador de requisição).
- **Lista de estoque:** estados de carregando/erro/vazio; remover a coluna "Status" falsa (ou calcular de verdade: sem estoque / com estoque / reservado); ações de escrita com `<Can permission="inventory.write">`.
- **Formulário de lote:** erro exibido uma vez; custo unitário obrigatório (sem padrão 0 silencioso).
- **Coluna de estoque faz uma requisição por linha (Médio):** buscar saldos em lote — backend: `GET /inventory?productVariantIds=a,b,c` (até 100 ids, `inventory.read`) retornando `{ data: [{ productVariantId, quantity, reserved, available }] }`; frontend usa uma única consulta por página.

## 3. Vendas, financeiro, compras e NF-e
- **Confirmação da NF-e pode não redirecionar:** navegar no `onSuccess` do hook/`mutateAsync`, não no callback do `mutate` que pode ser perdido; teste que pega o caso.
- **Cancelar venda/pedido com pagamento registrado:** esconder (ou desabilitar com explicação) o botão quando o documento financeiro tiver pagamento ativo (dados já vêm no detalhe); o 409 continua tratado.
- **Exportação de vendas usa um período que a lista não aplica:** backend `GET /sales` passa a aceitar `from`/`to` (data de negócio, mesmas regras do relatório) e `status`; a lista usa os mesmos campos de período (padrão: mês atual) e a exportação os mesmos valores — remove o aviso "só para exportação".
- **Invalidações:** criar/cancelar venda invalida recebíveis e dashboard; criar/cancelar/receber pedido invalida contas a pagar e dashboard; pagar/estornar invalida dashboard; alterar fornecedor invalida contas a pagar e importações.
- **Primeiro vencimento no passado:** validar no cliente como o backend.

## 4. Comum
- **ConfirmDialog e Modal:** foco inicial no primeiro controle (ou no botão de cancelar em confirmações destrutivas), foco preso dentro, Escape fecha (exceto durante envio), foco volta ao elemento que abriu, rolagem da página travada; ids únicos (`useId`); modais empilhados: Escape fecha só o de cima.
- **Falha transitória em /users/me na recarga manda ao login:** só sair da sessão em 401; em erro de rede/5xx mostrar tela de erro com "Tentar novamente" mantendo o token.
- **Sem tratamento global de 403:** interceptor/handler mostra "Você não tem permissão para esta ação." uma vez e revalida `/users/me` (papel pode ter mudado).
- **Limpeza de cache no login:** `setSession` sempre limpa o cache do React Query (não depender de convenção).

## Testes e aceite
Cada item acima com teste que falha antes (comportamento, não implementação). Aceite: CI verde (backend typecheck + testes no banco de teste; frontend lint 0, typecheck 0, testes, build).
