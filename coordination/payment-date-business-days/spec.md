# Data de pagamento na aprovação specification

## Goal and boundaries

- Goal: impedir que uma aprovação herde uma data de pagamento automática e restringir a data informada ao segundo dia útil posterior à validação.
- In scope: formulários de aprovação do dashboard e do detalhe da nota, e validação da API de atualização de nota.
- Out of scope: feriados nacionais, municipais ou corporativos; alteração de datas de notas já aprovadas; schema/migration.
- Source / approval: solicitação do usuário em 30/09/2026; data de pagamento confirmada como obrigatória.

## Observed facts and open decisions

| Type | Item | Evidence or decision needed |
|---|---|---|
| Observed fact | Dashboard, detalhe e API preenchem o próximo dia calendário como data padrão. | `src/app/dashboard/page.tsx`, `src/app/notas/[id]/page.tsx`, `src/app/api/notas/[id]/route.ts` |
| Observed fact | `dataPagamento` é opcional no contrato atual. | `src/lib/validations.ts` |
| Assumption | Dia útil significa segunda a sexta-feira, sem calendário de feriados. | Não há calendário de feriados no fluxo atual. |
| Decision | Ao aprovar sem informar data, a API deve recusar a aprovação. | Confirmado pelo usuário. |

## Domain

- Glossary and actors: gestor é o usuário que aprova; data de validação é o instante em que a API registra a aprovação; data de pagamento é o vencimento informado para a nota.
- State/lifecycle changes: uma nota em aprovação torna-se `APROVADO`; a data de pagamento não é mais preenchida automaticamente.

### Domain rules

- DR-1: ao abrir uma aprovação, o campo de data de pagamento deve iniciar vazio; nenhum cliente deve sugerir o próximo dia.
- DR-2: na aprovação, uma data de pagamento informada deve ser igual ou posterior ao segundo dia útil após a data de validação registrada pela API.
- DR-3: a API deve rejeitar uma aprovação cuja data de pagamento informada seja anterior ao mínimo, com mensagem acionável; a restrição não pode depender apenas do atributo `min` do navegador.
- DR-4: para uma validação em quarta-feira, 30/09/2026, o mínimo é sexta-feira, 02/10/2026.
- DR-5: a data de pagamento é obrigatória para aprovar uma nota.

## Acceptance scenarios

### AC-1: aprovação abre sem data pré-selecionada

**Given** uma nota apta à aprovação

**When** o gestor abre o formulário de aprovação no dashboard ou no detalhe

**Then** o campo de data de pagamento está vazio.

### AC-2: gestor escolhe a primeira data permitida

**Given** uma aprovação validada em 30/09/2026

**When** o gestor informa 02/10/2026 como data de pagamento

**Then** a aprovação é aceita e a data é persistida.

### AC-3: data anterior é bloqueada

**Given** uma aprovação validada em 30/09/2026

**When** o gestor tenta informar 01/10/2026

**Then** a interface não a disponibiliza como escolha válida

**And** a API rejeita uma chamada que tente persistir essa data.

### AC-4: data ausente não aprova

**Given** uma nota apta à aprovação

**When** o gestor não informa uma data de pagamento

**Then** a interface informa que o preenchimento é obrigatório

**And** a API rejeita a aprovação sem persistir alterações.

## Error, authorization, and edge cases

- A validação usa a data efetiva do servidor no momento da aprovação, evitando diferença de relógio do navegador.
- Sábados e domingos não contam como dias úteis; feriados ficam fora deste escopo.
- As permissões atuais para aprovar permanecem inalteradas.

## Technical decisions

| Decision | Chosen approach | Rationale | Consequence / migration |
|---|---|---|---|
| Fonte da regra | Função de cálculo de dias úteis reutilizável no servidor e no cliente. | Mantém o mínimo exibido e validado consistentes. | Sem migration. |
| Ponto de referência | Momento da aprovação no servidor. | É a origem de `dataValidacao`. | O cliente usa a data atual apenas para orientar; servidor é definitivo. |
| Semântica da data | API trata `dataPagamento` como data-calendário e a normaliza para meio-dia em São Paulo. | Evita deslocamento por fuso horário em payloads ISO. | Clientes externos podem enviar ISO UTC sem antecipar o dia. |

## Implementation and verification plan

1. Resolver a obrigatoriedade da data e atualizar DR/AC correspondente.
2. Remover os preenchimentos automáticos e configurar o mínimo nos dois formulários.
3. Remover o fallback da API e validar a data mínima antes da persistência.
4. Executar checagens focadas da regra de dias úteis e `npm run build`.

## Risks, rollout, and deferred work

- Sem calendário de feriados, um feriado em dia de semana será tratado como dia útil.
