# Visibilidade de notas conforme revisão registrada

## Objetivo

Corrigir o filtro compartilhado pelo dashboard, exportação e relatórios. Todas as notas devem ser vistas pelos usuários autorizados, exceto enquanto estiverem em avaliação administrativa até sua liberação.

Não há migration ou mudança de dados nesta correção.

## Regras de domínio

- DR-1: nota sem revisão administrativa é visível, independentemente de idade, valor ou passagem de mês.
- DR-2: revisão PENDENTE mantém a nota oculta no fluxo normal para todos os perfis. ADMIN continua acessando-a na fila administrativa para avaliar e liberar.
- DR-3: revisão LIBERADA torna a nota visível para aprovação, inclusive quando antiga ou com valor fiscal zero; o valor confirmado continua sendo utilizado pelo fluxo existente.
- DR-4: revisão IGNORADA mantém a nota oculta, conforme decisão anterior confirmada pelo usuário.
- DR-5: permissões e vínculos de acesso continuam aplicáveis. A correção não concede acesso a notas de outros fornecedores nem altera autorização de relatórios.
- DR-6: a classificação de novas notas na ingestão e os bloqueios de mutação durante revisão continuam vigentes. Consultas não criam revisões retroativas.

## Cenários de aceite

- AC-1: Dada nota antiga ou de valor zero sem revisão, quando usuário autorizado consultar dashboard, exportação ou relatórios, então a nota participa do resultado, respeitando filtros explícitos.
- AC-2: Dada revisão pendente, quando qualquer perfil consultar o fluxo normal, então a nota permanece oculta; ADMIN consegue avaliá-la na fila específica.
- AC-3: Dada revisão liberada, quando usuário autorizado consultar, então a nota aparece mesmo se antiga/zerada.
- AC-4: Dada revisão ignorada, quando usuário consultar o fluxo normal, então a nota permanece oculta e a decisão segue disponível na aba de ignoradas.
- AC-5: Dada passagem de mês sem alteração da revisão, quando repetir a consulta com os mesmos filtros, então a visibilidade não muda.
- AC-6: Dado usuário sem vínculo/permissão para uma nota ou relatório, quando consultar, então a correção não amplia seu acesso.

## Implementação e verificação

1. Remover classificação dinâmica por mês/valor do helper compartilhado e usar apenas a revisão persistida: sem revisão ou LIBERADA.
2. Conferir consumidores do helper e bloqueios de detalhes/mutação; preservar alterações locais de workflow já existentes.
3. Executar TypeScript, lint focado e revisão do diff. A validação não inclui banco ou deploy de produção.

## Limites

Notas já registradas como pendentes continuam exigindo decisão do ADMIN. Os resultados efetivos de produção dependem dessas decisões e dos dados existentes. Nenhuma migration, backfill ou envio de e-mail é necessário para essa correção.

## Evidências de entrega

- TypeScript: `tsc --noEmit --incremental false` passou.
- Lint focado: `eslint src/lib/invoice-admin-review-access.ts` passou.
- `git diff --check -- src/lib/invoice-admin-review-access.ts` passou.
- Revisão dos consumidores confirmou uso do filtro compartilhado em dashboard, exportação, relatórios e lembretes; detalhes, histórico, comunicação e mutações continuam bloqueando revisão não liberada.
- TypeScript foi verificado no checkout local, que também contém outras alterações em andamento.
- Sem validação contra banco real ou publicação em produção.
