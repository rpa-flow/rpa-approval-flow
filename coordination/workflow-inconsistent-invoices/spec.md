# Responsáveis por etapa e encaminhamento de notas inconsistentes

## Objetivo e limites

- Objetivo: permitir que ADMIN escolha responsáveis por etapa pelo fornecedor ou por uma lista fixa e encaminhe notas `DADOS_INCONSISTENTES` a uma etapa escolhida.
- Em escopo: dois modos exclusivos de responsáveis por etapa; atribuição e notificação de várias pessoas; conclusão da etapa por qualquer pessoa atribuída; exibição do motivo de inconsistência; escolha da etapa por nota e transição de status; auditoria e migração compatível com configurações existentes.
- Fora de escopo: misturar gestores do fornecedor e usuários fixos na mesma etapa; quórum ou exigência de aprovação de todos; alterar configuração de execução já iniciada; notas de outros tipos.
- Fonte: pedidos e decisões do usuário nesta conversa. A expansão descrita aqui ainda não está implementada nem aprovada para implementação.

## Fatos observados e decisão pendente

| Tipo | Item | Evidência ou decisão necessária |
|---|---|---|
| Fato observado | A lista atual mostra notas `AGUARDANDO_APROVACAO` sem execução e o encaminhamento usa a primeira etapa. | `src/app/configuracoes/workflows/page.tsx`, `src/app/api/workflows/enroll/route.ts` |
| Fato observado | A conclusão de etapa só aceita nota `AGUARDANDO_APROVACAO`, não processada e com processamento `PENDENTE`. | `src/app/api/notas/[id]/workflow/complete/route.ts` |
| Fato observado | O workflow e as tarefas guardam a etapa selecionada; a posição da tarefa define a próxima etapa. | `prisma/schema.prisma`, rota de conclusão |
| Decisão do usuário | O destino deve ser selecionável e variável; neste caso o destino esperado é o segundo step. | Pedido nesta conversa |
| Decisão do usuário | Ao encaminhar, a nota pode ser movida imediatamente para `AGUARDANDO_APROVACAO`/`PENDENTE` e atribuída à etapa escolhida, para que o gestor atue nela. | Pedido nesta conversa; a auditoria deve preservar o status anterior. |
| Decisão do usuário | A tela deve exibir o motivo enviado no e-mail para ajudar o ADMIN a decidir o destino. | Pedido nesta conversa. A origem proposta é `Invoice.observacaoValidacao`, que registra a observação associada ao status inconsistente. |
| Decisão do usuário | Cada etapa usa exatamente um modo de responsabilidade: gestores vinculados ao fornecedor da nota, ou uma lista de usuários do sistema. Os modos não se combinam. | Esclarecimento nesta conversa. |
| Decisão do usuário | Havendo mais de um responsável atribuído à etapa, qualquer um pode concluí-la. | Resposta nesta conversa. |
| Proposta técnica | No modo fornecedor, atribuir a todos os gestores ativos (`GESTOR`) atualmente vinculados ao fornecedor no momento em que a nota entra na etapa. No modo lista, atribuir a todos os usuários ativos selecionados (`GESTOR` ou `ADMIN`). Uma conclusão encerra as outras tarefas da mesma etapa. Se não houver destinatário ativo, não criar atribuição parcial e devolver erro claro ao administrador. | Adaptar o relacionamento `ManagerSupplier` e o estado atual das tarefas. Confirmar junto com o escopo revisado. |

## Domínio

### Regras

- DR-1: somente ADMIN pode encaminhar notas inconsistentes.
- DR-2: para cada nota, ADMIN escolhe uma etapa da versão NFS-e publicada; a seleção não é fixa nem pressupõe o segundo step.
- DR-3: a execução usa a versão publicada no momento do encaminhamento. A etapa escolhida passa a ser a tarefa ativa e, ao concluí-la, a execução segue para a próxima etapa por posição.
- DR-4: só podem ser encaminhadas notas sem execução, não processadas e não retidas por revisão administrativa; a tarefa exige responsável ativo que não seja fornecedor.
- DR-5: no encaminhamento bem-sucedido, a nota muda de `DADOS_INCONSISTENTES` para `AGUARDANDO_APROVACAO` com processamento `PENDENTE`, permitindo que o gestor atue pelo fluxo normal.
- DR-6: o sistema registra nota, status anterior e novo, etapa escolhida, responsável e ator administrativo na auditoria. Não apaga nem substitui histórico preexistente.
- DR-7: notas pendentes existentes continuam encaminhadas à primeira etapa pelo comportamento atual.
- DR-8: para notas inconsistentes, a tela mostra ao ADMIN o motivo associado à inconsistência (`observacaoValidacao`) antes de confirmar a etapa de destino; quando não houver motivo, mostra indicação explícita de ausência.
- DR-9: cada etapa configura um e somente um modo de responsabilidade: `GESTORES_DO_FORNECEDOR` ou `USUARIOS_SELECIONADOS`.
- DR-10: no modo `GESTORES_DO_FORNECEDOR`, ao entrar na etapa, a nota é atribuída aos gestores ativos (`GESTOR`) vinculados ao fornecedor da nota. Se não houver gestor ativo, a atribuição não é criada parcialmente e a operação informa o problema.
- DR-11: no modo `USUARIOS_SELECIONADOS`, ADMIN configura uma ou mais contas ativas do sistema com perfil `GESTOR` ou `ADMIN`; cada nova nota/etapa é atribuída a essa lista.
- DR-12: os modos são mutuamente exclusivos; o modo fornecedor não acrescenta automaticamente usuários fixos, e o modo de lista não acrescenta automaticamente os gestores do fornecedor.
- DR-13: todos os responsáveis resolvidos no momento da atribuição recebem tarefa e aviso. Qualquer um deles pode concluir a etapa; a conclusão fecha as demais tarefas daquela mesma etapa e cria as tarefas/avisos do próximo step.
- DR-14: novos vínculos do fornecedor são resolvidos quando a nota entra em cada etapa. Responsáveis já atribuídos permanecem como fotografia da atribuição registrada naquela etapa.
- DR-15: notas pendentes existentes continuam entrando pela primeira etapa; notas inconsistentes continuam permitindo seleção de etapa por nota e mudança imediata para pendente.

## Cenários de aceite

### AC-1: encaminhamento de nota inconsistente para etapa escolhida

**Given** ADMIN, uma versão NFS-e publicada com ao menos duas etapas e uma nota `DADOS_INCONSISTENTES` elegível

**When** ADMIN seleciona a nota, escolhe o segundo step e confirma o encaminhamento

**Then** a nota passa a `AGUARDANDO_APROVACAO`/`PENDENTE` e recebe tarefa/aviso para os responsáveis resolvidos pelo modo da etapa escolhida, com registro auditável da etapa

**And** o primeiro step não recebe tarefa para essa execução

### AC-2: motivo visível antes do encaminhamento

**Given** ADMIN visualiza notas `DADOS_INCONSISTENTES` na tela de encaminhamento

**When** a nota possui observação de validação registrada

**Then** a observação aparece junto à nota antes da escolha/confirmação da etapa

**And** se não houver observação, a tela informa que o motivo não foi registrado

### AC-3: destino pode variar

**Given** notas inconsistentes elegíveis e uma versão publicada

**When** ADMIN escolhe destinos diferentes para notas diferentes

**Then** cada nota inicia na etapa selecionada, sem alterar as etapas da versão publicada

### AC-4: conclusão e continuidade

**Given** uma nota encaminhada diretamente a uma etapa intermediária

**When** seu responsável conclui a tarefa

**Then** a tarefa seguinte é criada para a etapa posterior, se existir

**And** a nota já estava no estado pendente de aprovação desde o encaminhamento

### AC-5: modo fornecedor resolve gestores

**Given** uma etapa configurada para usar gestores do fornecedor e uma nota de um fornecedor com dois gestores ativos vinculados

**When** a nota entra nessa etapa

**Then** os dois gestores recebem tarefas e avisos

**And** um deles conclui a etapa e a tarefa do outro é encerrada, sem exigir segunda aprovação

### AC-6: lista de usuários é exclusiva

**Given** uma etapa configurada com uma lista de usuários do sistema

**When** a nota entra na etapa

**Then** só os usuários selecionados recebem tarefas e avisos, mesmo que outros gestores estejam vinculados ao fornecedor

### AC-7: nenhum gestor ativo vinculado

**Given** uma etapa no modo fornecedor e um fornecedor sem gestor `GESTOR` ativo vinculado

**When** a nota tenta entrar na etapa

**Then** nenhuma tarefa parcial é criada e o sistema reporta que não há responsável ativo disponível

### AC-8: seleção inválida ou concorrente

**Given** nota já encaminhada, retida por revisão, responsável inativo ou etapa fora da versão publicada

**When** ADMIN tenta encaminhar

**Then** a operação individual falha com motivo claro e não cria execução/tarefa parcial

## Autorização, erros e concorrência

- A API valida ADMIN, elegibilidade, etapa pertencente à versão publicada e responsável ativo no servidor.
- A atribuição resolve os destinatários no servidor; IDs de usuário enviados pelo cliente não podem sobrepor o modo publicado da etapa.
- Cada nota é processada transacionalmente com bloqueio da nota, protegendo contra encaminhamento duplicado.
- A conclusão é concorrente e idempotente: após uma pessoa concluir, os demais pedidos de conclusão da mesma etapa recebem conflito e não avançam o workflow novamente.
- A API retorna resultado individual para cada nota; avisos são processados após os encaminhamentos bem-sucedidos.
- Notas bloqueadas por revisão administrativa não podem ser encaminhadas.

## Decisões técnicas

| Decisão | Abordagem proposta | Motivo | Consequência/migration |
|---|---|---|---|
| Responsabilidade da etapa | Persistir modo explícito e relações com usuários fixos; no modo fornecedor resolver relações `ManagerSupplier` quando a nota entra na etapa. Os modos são exclusivos. | Mantém comportamento independente para fornecedor e lista manual, sem misturar os modos. | Migration versionada para preservar o gestor único atual como modo `SELECTED_USERS` e converter tarefas para vários destinatários. |
| Múltiplas tarefas por etapa | Permitir várias `InvoiceWorkflowTask` para um par execução/etapa, uma por responsável; encerrar tarefas irmãs quando uma conclusão vencer. | Atribuir e notificar cada responsável, mantendo autoria por usuário. | Substituir a unicidade atual `(executionId, stepId)` por índice adequado; atualizar consultas e endpoint de conclusão. |
| Estado ao encaminhar | Mudar imediatamente para `AGUARDANDO_APROVACAO` e `PENDENTE`, preservando o estado anterior na auditoria. | O gestor passa a tratar a nota pelas ações normais da etapa selecionada. | Atualiza endpoint de encaminhamento e grava histórico de status; sem mudança necessária na guarda da conclusão. |
| Interface | Exibir motivo da inconsistência e seletor de etapa por nota; notas pendentes mantêm envio direto à primeira etapa. | O ADMIN precisa do contexto do e-mail para escolher o destino; etapa não fica codificada como segundo step. | O endpoint de listagem retorna `observacaoValidacao`, mesmo campo usado como motivo da validação no e-mail. |

## Fases de implementação e verificação

1. Modelo e migration: modos exclusivos, relações de usuários fixos e suporte a várias tarefas por etapa; preservar configurações e execuções existentes.
2. Backend de configuração e atribuição: validar modo e usuários, resolver responsáveis do fornecedor ou lista fixa em entrada automática, avanço de etapa e encaminhamento manual.
3. Conclusão e acesso: qualquer responsável pode concluir uma vez; atualizar consultas, filas e notificações para várias tarefas.
4. Interface: configurar modo e lista de usuários por etapa; manter encaminhamento de inconsistentes, motivo e destino individual.
5. Verificação: testes focados de migration/domínio, autorização, concorrência, filas e `npm run build`.
6. Revisão final contra DR-1–DR-15 e AC-1–AC-8.

## Riscos e rollout

- Uma etapa inicial escolhida pode pular responsabilidades anteriores por intenção administrativa; registrar explicitamente a etapa inicial na auditoria.
- Não encaminhar nota bloqueada pela revisão administrativa nem permitir alteração da versão de uma execução já iniciada.
- O PR #122 contém a primeira versão do encaminhamento manual e foi concluído. Esta ampliação será entregue em um novo PR.
- Migration precisa ser validada em banco PostgreSQL de teste com configuração existente e execução em andamento; não usar banco compartilhado para experimento destrutivo.

