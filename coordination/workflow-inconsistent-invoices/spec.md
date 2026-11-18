# Encaminhar notas inconsistentes a uma etapa escolhida

## Objetivo e limites

- Objetivo: permitir que ADMIN encaminhe notas `DADOS_INCONSISTENTES` diretamente a uma etapa escolhida da versão NFS-e publicada, para que o responsável trate a inconsistência.
- Em escopo: seleção dessas notas na configuração de workflow, exibição do motivo registrado para a inconsistência, escolha da etapa por nota, criação da execução/tarefa/aviso e trilha de auditoria, validação e conclusão da tarefa.
- Fora de escopo: alterar regras de publicação, modificar etapas de workflows já iniciados, encaminhamento automático, notas de outros tipos e ações em lote com destinos distintos da seleção individual.
- Fonte: pedido e aprovações do usuário nesta conversa; implementação concluída neste checkout.

## Fatos observados e decisão pendente

| Tipo | Item | Evidência ou decisão necessária |
|---|---|---|
| Fato observado | A lista atual mostra notas `AGUARDANDO_APROVACAO` sem execução e o encaminhamento usa a primeira etapa. | `src/app/configuracoes/workflows/page.tsx`, `src/app/api/workflows/enroll/route.ts` |
| Fato observado | A conclusão de etapa só aceita nota `AGUARDANDO_APROVACAO`, não processada e com processamento `PENDENTE`. | `src/app/api/notas/[id]/workflow/complete/route.ts` |
| Fato observado | O workflow e as tarefas guardam a etapa selecionada; a posição da tarefa define a próxima etapa. | `prisma/schema.prisma`, rota de conclusão |
| Decisão do usuário | O destino deve ser selecionável e variável; neste caso o destino esperado é o segundo step. | Pedido nesta conversa |
| Decisão do usuário | Ao encaminhar, a nota pode ser movida imediatamente para `AGUARDANDO_APROVACAO`/`PENDENTE` e atribuída à etapa escolhida, para que o gestor atue nela. | Pedido nesta conversa; a auditoria deve preservar o status anterior. |
| Decisão do usuário | A tela deve exibir o motivo enviado no e-mail para ajudar o ADMIN a decidir o destino. | Pedido nesta conversa. A origem proposta é `Invoice.observacaoValidacao`, que registra a observação associada ao status inconsistente. |

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

## Cenários de aceite

### AC-1: encaminhamento de nota inconsistente para etapa escolhida

**Given** ADMIN, uma versão NFS-e publicada com ao menos duas etapas e uma nota `DADOS_INCONSISTENTES` elegível

**When** ADMIN seleciona a nota, escolhe o segundo step e confirma o encaminhamento

**Then** a nota passa a `AGUARDANDO_APROVACAO`/`PENDENTE` e a tarefa ativa é atribuída ao responsável configurado no segundo step, com aviso e registro auditável da etapa escolhida

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

### AC-5: seleção inválida ou concorrente

**Given** nota já encaminhada, retida por revisão, responsável inativo ou etapa fora da versão publicada

**When** ADMIN tenta encaminhar

**Then** a operação individual falha com motivo claro e não cria execução/tarefa parcial

## Autorização, erros e concorrência

- A API valida ADMIN, elegibilidade, etapa pertencente à versão publicada e responsável ativo no servidor.
- Cada nota é processada transacionalmente com bloqueio da nota, protegendo contra encaminhamento duplicado.
- A API retorna resultado individual para cada nota; avisos são processados após os encaminhamentos bem-sucedidos.
- Notas bloqueadas por revisão administrativa não podem ser encaminhadas.

## Decisões técnicas

| Decisão | Abordagem proposta | Motivo | Consequência/migration |
|---|---|---|---|
| Persistência da etapa inicial | Reutilizar `InvoiceWorkflowTask` com `stepId` da etapa escolhida. | O modelo já associa tarefa à etapa e a próxima etapa deriva da posição. | Sem migration prevista; validar restrição única por execução/etapa. |
| Estado ao encaminhar | Mudar imediatamente para `AGUARDANDO_APROVACAO` e `PENDENTE`, preservando o estado anterior na auditoria. | O gestor passa a tratar a nota pelas ações normais da etapa selecionada. | Atualiza endpoint de encaminhamento e grava histórico de status; sem mudança necessária na guarda da conclusão. |
| Interface | Exibir motivo da inconsistência e seletor de etapa por nota; notas pendentes mantêm envio direto à primeira etapa. | O ADMIN precisa do contexto do e-mail para escolher o destino; etapa não fica codificada como segundo step. | O endpoint de listagem retorna `observacaoValidacao`, mesmo campo usado como motivo da validação no e-mail. |

## Fases de implementação e verificação

1. Domínio/API: elegibilidade das notas inconsistentes, destino explícito, transição imediata de status, transação, notificação e auditoria.
2. Interface: listar notas inconsistentes e selecionar etapa por nota, com estados de erro e resultado individual.
3. Verificação: testes focados de regras/API e `git diff --check`; build conforme proporcionalidade.
4. Revisão final contra DR-1–DR-8 e AC-1–AC-5.

## Riscos e rollout

- Uma etapa inicial escolhida pode pular responsabilidades anteriores por intenção administrativa; registrar explicitamente a etapa inicial na auditoria.
- Não encaminhar nota bloqueada pela revisão administrativa nem permitir alteração da versão de uma execução já iniciada.
- Sem migration prevista; confirmar schema e APIs durante a implementação.

