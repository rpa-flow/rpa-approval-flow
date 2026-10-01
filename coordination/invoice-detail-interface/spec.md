# Nota: detalhamento da interface specification

## Goal and boundaries

- Goal: transformar o detalhamento da nota em uma superfície operacional escaneável, que prioriza resumo, ação disponível e dados essenciais.
- In scope: composição visual, responsividade, semântica, loading/erro/vazio, agrupamento de informações e controles da página de detalhe.
- Out of scope: APIs, payloads, autorização, estados de domínio, regras de aprovação/recusa e paleta/tokens.
- Source / approval: usuário aprovou a direção de reorganizar cabeçalho-resumo, grupos de dados, ações contextuais e histórico secundário.

## Observed facts and open decisions

| Type | Item | Evidence or decision needed |
|---|---|---|
| Observed fact | A página concentra metadados, informações fiscais, ações críticas e histórico em cards visualmente equivalentes. | `src/app/notas/[id]/page.tsx` |
| Decision | Aplicar Corporate Precision e os componentes/tokens existentes; não introduzir cores ou contratos. | `design.md` e aprovação do usuário |
| Decision | Histórico permanece na página como apoio, depois da ação aplicável ao estado da nota. | Direção aprovada |

## Domain

- Glossary and actors: gestor/admin avalia, aprova, recusa ou corrige o status de uma nota; fornecedor somente consulta segundo as permissões existentes.
- State/lifecycle changes: nenhum; somente a apresentação dos estados atuais.

### Domain rules

- DR-1: As ações e seus requisitos existentes devem permanecer disponíveis somente para os mesmos papéis e estados de nota atuais.
- DR-2: Dados de nota, valores, histórico e mensagens devem usar os mesmos endpoints e payloads atuais.
- DR-3: Estados de carregamento, falha, nota ausente e histórico vazio devem se comunicar sem confundir o usuário sobre os dados exibidos.

## Acceptance scenarios

### AC-1: leitura operacional em desktop

**Given** um gestor abre uma nota existente

**When** a página é carregada

**Then** identifica número, fornecedor, status, valor e ação disponível antes dos dados complementares

**And** os dados ficam agrupados por identificação, serviço/tributação e acompanhamento.

### AC-2: uso em mobile

**Given** um gestor abre o detalhe em uma tela estreita

**When** navega pelos dados e ações

**Then** o resumo e a ação aplicável aparecem antes dos grupos secundários

**And** nenhum controle ou texto essencial transborda o viewport.

### AC-3: estados de dados

**Given** a busca está carregando, falha ou a nota não é encontrada

**When** o estado é apresentado

**Then** a tela usa uma indicação distinta, acessível e consistente com o design system.

### AC-4: interação acessível

**Given** uma pessoa navega por teclado

**When** alcança ações e avaliação de aprovação

**Then** identifica foco, estado selecionado e mensagens de erro sem depender somente de cor.

## Error, authorization, and edge cases

- Manter o redirecionamento de não autenticado, a mensagem de acesso negado e as regras de habilitação atuais.
- Não tratar falha de histórico como inexistência da nota; apresentar histórico indisponível de modo separado quando aplicável.

## Technical decisions

| Decision | Chosen approach | Rationale | Consequence / migration |
|---|---|---|---|
| Hierarquia | Reutilizar `PageHeader`, `SectionCard`, `LoadingState`, `EmptyState` e `ErrorState` quando compatíveis. | Alinha o detalhe ao dashboard e ao ui-kit. | Sem migração. |
| Dados | Trocar grade uniforme de cards por grupos com `dl` e blocos de apoio. | Diminui ruído e preserva densidade operacional. | Sem mudança de dados. |
| Ações | Manter ações contextuais e priorizá-las antes do histórico em mobile. | Reduz a distância entre decisão e execução. | Sem mudança de regra. |

## Implementation and verification plan

1. Reorganizar o detalhe e seus estados apenas no componente de página.
2. Executar typecheck, build e inspeção de diff.
3. Validar independentemente DR-1 a DR-3 e AC-1 a AC-4.

## Risks, rollout, and deferred work

- Sem sessão autenticada não há inspeção visual com dados reais; revisar os estados conectados em ambiente autenticado permanece recomendado.
