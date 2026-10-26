# Migração do caderninho (Bloco E)

**Data:** 2026-10-26
**Status:** proposta para revisão do usuário.
**Depende de:** crediário (`2026-10-26-credit-design.md`) para perfil e limite. Sem o crediário, a importação funciona, mas ainda não define perfil e limite.

## Requisitos do usuário (2026-10-26)
- **Volume:** são poucos clientes, menos de 100.
- **Dados ruins:**
  - não tem CPF;
  - às vezes tem celular;
  - tem só valores e nome;
  - às vezes tem a data da compra.
  - Por isso, é preciso uma **boa revisão** antes de gravar.
- **Juros e multa:** as dívidas antigas entram **sem** multa nem juros, por enquanto.
- **Alternativas:** estudar outras formas de entrada além da digitação.

## 1. O que é gravado
- **Uma "dívida anterior" por anotação:** é uma conta a receber com origem `LEGACY` ("Saldo anterior — caderninho").
  - Fica no cliente, `noLateFees = true`, **sem venda e sem movimento de estoque**.
- **Valor:** o que o cliente ainda deve, que é o total menos o já pago. O histórico pago fica só como observação.
- **Parcelas:**
  - **Com vencimentos anotados:** as parcelas são criadas com esses vencimentos.
  - **Sem vencimentos:** é criada uma parcela única "a combinar", com vencimento na data da importação e marcada como "vencimento a combinar".
    - Não aparece como atrasada.
    - Pode ser **renegociada** depois, dividida em parcelas com datas, pela ação "Parcelar saldo".
- **Cliente:**
  - Se o cliente não existir, é criado com nome, celular opcional e o perfil escolhido.
  - O código do cliente é gerado normalmente.

## 2. Formas de entrada
1. **Planilha modelo (CSV)**
   - **Modelo para baixar:** Excel ou Google Sheets salvam em CSV; não é preciso dependência nova.
   - **Colunas:**
     - `nome`, obrigatório;
     - `celular`;
     - `data_compra`;
     - `descricao`;
     - `valor_total`;
     - `valor_pago`;
     - `vencimentos` (lista "dd/mm/aaaa=valor; …", opcional);
     - `perfil` (Novo, Regular, Bom ou Excelente);
     - `observacao`.
   - **Formatos aceitos:** separador `;` ou `,`, valores com vírgula e datas dd/mm/aaaa.
2. **Lançamento rápido** (tela pensada para celular)
   - Busca ou cria o cliente.
   - Adiciona uma ou mais dívidas com valor, data se souber e observação.
   - O lançamento vai para o mesmo lote de revisão abaixo.
3. **Fotos do caderno**
   - É um procedimento fora do sistema: ela fotografa as páginas e o Claude transcreve para o modelo CSV.
   - O CSV volta para a importação com revisão. Nada é gravado sem a conferência dela.
   - Documentar o passo a passo no README.

## 3. Revisão (o coração desta etapa)
- **Lote de importação** (`LegacyImportBatch`): cada upload ou sessão de lançamento rápido vira um lote com linhas (`LegacyImportRow`).
  - **Situação do lote:** `RASCUNHO`, `CONFIRMADO` ou `DESFEITO`.
  - **Situação da linha:** `OK`, `AVISO`, `ERRO` ou `IGNORADA`.
- **Avisos por linha**, todos editáveis na própria tabela:
  - sem celular;
  - sem data;
  - valor pago maior que o total (é erro);
  - valor zero (é erro);
  - celular inválido;
  - data no futuro;
  - **nome parecido com cliente existente ou com outra linha**, com a sugestão de juntar.
    - A comparação normaliza acentos, maiúsculas e espaços e usa similaridade de texto, como "Maria Silva" e "Maria S.".
    - Quem decide se é a mesma pessoa é a usuária: vincular ao existente ou criar novo.
- **Resumo do lote:**
  - número de clientes novos e de clientes existentes;
  - total em aberto;
  - linhas com aviso e com erro.
- **Confirmação:**
  - só é possível sem linhas com `ERRO`;
  - grava tudo numa transação, com idempotência;
  - aplica o perfil escolhido. O limite vira o maior entre o limite do perfil e o saldo importado, para o cliente não nascer "estourado"; a regra é configurável.
- **Desfazer lote:** permitido enquanto nenhuma dívida do lote recebeu pagamento. Cancela as contas e mantém os clientes criados.

## 4. Telas
- **Menu:** Financeiro → **Migração do caderninho**, só para ADMIN.
- **Etapas:** baixar modelo, enviar CSV ou abrir o lançamento rápido, revisar, confirmar.
- **Lista de lotes:** com a situação e o resumo de cada um.
- **Ficha do cliente e contas a receber:** mostram as dívidas antigas com a etiqueta "Caderninho".

## 5. Permissões
- `credit.manage`, só ADMIN: importar, confirmar e desfazer.
- `receivables.pay`, já existente: registrar pagamentos nas dívidas antigas, como em qualquer conta.

## 6. Dados
- **Lotes e linhas:**
  - `LegacyImportBatch`: id, criadoPor, situação, origem (CSV ou manual), resumo e datas.
  - `LegacyImportRow`: lote, dados brutos (JSON), dados normalizados, avisos, cliente vinculado ou "criar novo", situação.
- **Ligações com o resto:**
  - `FinancialOriginType.LEGACY`;
  - `FinancialDocument.noLateFees`, compartilhado com o crediário;
  - `FinancialParcel.dueDateUnknown`.

## Testes e aceite
- **Leitura do CSV:**
  - separadores `;` e `,`;
  - vírgula decimal e datas dd/mm/aaaa;
  - BOM do Excel;
  - linhas vazias.
- **Avisos e erros por linha.**
- **Detecção de nomes parecidos:**
  - acentos e abreviação;
  - não acusa nomes diferentes.
- **Confirmação:**
  - atômica e idempotente;
  - aplica perfil e limite.
- **Parcelas:**
  - "a combinar" não aparece como vencida;
  - renegociação em parcelas.
- **Desfazer:**
  - bloqueado com pagamento.
- **Telas:**
  - celular e desktop, nos dois temas.
