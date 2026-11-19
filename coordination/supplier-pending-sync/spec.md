# Sincronizar gestores em notas pendentes

## Objetivo e limites

- Objetivo: permitir que um ADMIN sincronize notas pendentes de todos os fornecedores com os gestores atualmente vinculados e notifique esses gestores.
- Escopo: ação manual global na gestão de fornecedores; percorrer todos os fornecedores, localizar notas elegíveis por fornecedor, enviar e-mail aos gestores atuais daquele fornecedor, registrar resultado e mostrar resumo da operação.
- Fora de escopo: workflow de aprovação, reatribuição individual por nota, notificações automáticas ao salvar vínculos e notas em outros estados.
- Base solicitada: `origin/main`, que não contém workflow de aprovação no schema; a branch aberta contém alterações locais de workflow e outros arquivos modificados. Essas alterações serão preservadas.

## Fatos observados e decisões

| Tipo | Item | Evidência ou decisão |
|---|---|---|
| Fato observado | Notas estão relacionadas ao fornecedor; a lista de gestores é relação do fornecedor, não há gestor persistido por nota na `main`. Assim, atualmente não há conjunto anterior por nota contra o qual comparar uma sincronização. | `prisma/schema.prisma` em `origin/main` |
| Fato observado | Edição do fornecedor permite atualizar `managerIds`; lembretes enviam e-mail a gestores vinculados e e-mails extras. | `src/app/api/fornecedores/[id]/route.ts`, `src/app/api/notas/lembretes/route.ts` em `origin/main` |
| Decisão da solicitação | A sincronização deve ser uma opção explícita e global: percorrer todos os fornecedores, localizar notas pendentes e vincular/notificar os gestores correspondentes. | Conversa de 05/11/2026 |
| Decisão da solicitação | Enviar e-mail somente às notas cuja lista de gestores vinculados for alterada pela sincronização; notas sem alteração não devem receber e-mail. | Conversa de 05/11/2026 |
| Premissa proposta | A ação fica disponível a ADMIN na gestão/edição do fornecedor e atua nas notas do fornecedor com status `AGUARDANDO_APROVACAO`, não processadas e com processamento `PENDENTE`, excluindo notas retidas em revisão administrativa. | Confirmar com a aprovação desta especificação |
| Decisão da solicitação | Os destinatários são todos os gestores atualmente vinculados ao fornecedor, inclusive gestores inativos; e-mails extras ficam fora desta ação. Cada nota recebe um e-mail endereçado ao conjunto de gestores. | Solicitação de 05/11/2026 |

## Domínio

### Regras

- DR-1: Somente ADMIN pode iniciar a sincronização global.
- DR-2: A ação percorre todos os fornecedores e compara, em cada nota elegível, os gestores atualmente persistidos para a nota com os gestores atualmente vinculados ao fornecedor. A sincronização altera somente as notas em que os conjuntos diferem.
- DR-3: Enviar e-mail de solicitação de aprovação somente para notas cuja lista de gestores foi efetivamente alterada, endereçando a mensagem a todos os gestores atuais vinculados ao fornecedor da nota, inclusive inativos, com endereços deduplicados. Não enviar para notas sem alteração.
- DR-4: Registrar cada tentativa por nota nos registros existentes de notificação/auditoria, incluindo destinatários e falha de envio quando houver.
- DR-5: A resposta apresenta contagem global e por fornecedor de notas encontradas, e-mails enviados, falhas e notas ignoradas por falta de destinatários. Uma falha em uma nota não interrompe as demais.
- DR-6: Executar novamente a ação é permitido e envia novamente; a interface deve avisar que haverá novo envio antes de confirmar.

## Cenários de aceite

### AC-1: sincronizar notas pendentes de todos os fornecedores

**Dado** fornecedores com gestores vinculados e notas antigas ainda elegíveis  
**Quando** ADMIN confirma “Sincronizar gestores nas notas pendentes”  
**Então** o sistema percorre todos os fornecedores e envia cada nota elegível a todos os gestores atuais vinculados àquele fornecedor  
**E** a resposta exibe o resumo global e por fornecedor  
**E** o conteúdo e o status das notas permanecem inalterados.

### AC-2: proteger notas fora do escopo

**Dado** notas de qualquer fornecedor aprovadas, processadas, em processamento, inconsistentes ou retidas em revisão administrativa  
**Quando** o ADMIN executa a sincronização  
**Então** essas notas não são notificadas nem alteradas.

### AC-3: falha ou ausência de destinatários

**Dado** uma nota elegível sem gestor ativo, ou cujo envio de e-mail falha  
**Quando** a sincronização é executada  
**Então** o resultado identifica a nota como sem destinatário ou falha de envio, registra o resultado e continua processando as demais.

### AC-4: autorização

**Dado** usuário não ADMIN  
**Quando** tenta consultar/executar a ação  
**Então** recebe resposta de acesso negado e nenhum e-mail é enviado.

## Decisões técnicas

| Decisão | Abordagem proposta | Consequência |
|---|---|---|
| Persistência | Persistir por nota o conjunto de gestores da última sincronização concluída, sem substituir o vínculo de acesso atual, que continua derivado do fornecedor. Comparar esse snapshot ao conjunto atual de gestores do fornecedor. | Exige migration versionada. Notas sem snapshot são consideradas não sincronizadas; se elegíveis, a primeira sincronização grava o snapshot e envia e-mail por representar a primeira alteração/sincronização efetiva. |
| Execução | Endpoint protegido e operação global em lote com resultado individual por nota e por fornecedor; botão explícito na gestão de fornecedores. | Repetições reenviam e-mail; requer confirmação clara na interface. |
| Escopo | Implementar sobre `main`, preservando o checkout atual e sem incorporar as alterações locais de workflow. | A execução deve ocorrer em checkout baseado em `main` ou reaplicar somente os arquivos autorizados após alinhamento. |

## Plano de implementação e verificação

1. Criar endpoint ADMIN para sincronização e notificação por nota elegível.
2. Adicionar ação explícita e resumo de sucesso/falhas na gestão de fornecedor.
3. Cobrir filtro, autorização, deduplicação e falha parcial com verificações focadas; executar build se proporcional.
4. Revisar diff contra DR-1–DR-6 e AC-1–AC-4.

## Riscos e pendências

- Aprovar ou corrigir a premissa de elegibilidade acima. Notas sem snapshot serão tratadas como ainda não sincronizadas; a primeira execução que as processar enviará e-mail, e execuções seguintes só enviarão quando o conjunto de gestores mudar.
- O checkout atual está em `codex/admin-status-email-gestores` com alterações locais extensas; nenhuma mudança de produto foi feita nesta etapa.
