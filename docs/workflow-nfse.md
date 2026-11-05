# Workflow de aprovação de NFS-e

## Situação de implementação

Este recurso ainda precisa de validação com PostgreSQL, Microsoft Graph e interface no ambiente de teste. A migration não foi aplicada durante o desenvolvimento. Não ativar em produção antes de concluir esses ensaios.

## Configuração

Em Configurações → Workflow de aprovação, o administrador cria um rascunho com etapas ordenadas, gestor, alcance de consulta e campos por etapa. A publicação exige avaliação do serviço, uma etapa com data de pagamento obrigatória e OC ou contrato, e data de pagamento editável na etapa final para correção caso o prazo tenha passado. Para alterar uma versão, copie-a e publique o novo rascunho; notas já encaminhadas conservam a versão anterior.

Somente o administrador pode selecionar notas anteriores pendentes e encaminhá-las. Uma nota não pode ser encaminhada duas vezes ou quando está retida em revisão administrativa. Após a primeira publicação, novas NFS-e iniciam o workflow automaticamente; se houver revisão administrativa, a atribuição ocorre após a liberação. Se o primeiro responsável estiver inativo, a execução fica bloqueada até que um administrador o reative e retome a nota.

No dashboard, uma nota com workflow ativo oferece a ação de abrir a etapa. O responsável preenche os campos editáveis e conclui sua etapa. A última etapa exige avaliação, OC ou contrato e data válida, e somente então a nota recebe o status `APROVADO` e fica disponível para processamento.

## Avisos

As atribuições geram registros pendentes e uma tentativa de processamento após a operação. A interface administrativa mostra os avisos mais recentes, permite processar a fila e solicitar reenvio com justificativa. Um resultado incerto pode representar envio já aceito: conferir antes de reenviar. Simulação não comprova envio real.

Para recuperação agendada, configurar `CRON_SECRET` no ambiente e chamar `GET /api/workflows/notifications/process` com `Authorization: Bearer <segredo>`. A configuração de um agendador externo é necessária; não há agendamento criado automaticamente. Os lotes são limitados. O Microsoft Graph precisa estar configurado para envio real.

## Implantação e validação pendentes

- Aplicar a migration versionada em ambiente isolado e verificar compatibilidade com o histórico existente, antes de qualquer ambiente compartilhado.
- Testar autorização por responsável e por alcance configurado; testar seleção de notas, conflitos e concorrência de transições em PostgreSQL real.
- Validar interface em telas pequenas e com teclado, políticas de campos, dados obrigatórios, auditoria e integração com o processamento existente.
- Validar envio real e recuperação de avisos, inclusive interrupção após aceite do provedor. O aceite do Graph não garante entrega na caixa de entrada.
- Resolver a concorrência entre avisos legados e entrada no workflow: uma nova checagem reduz a janela, mas um aviso legado já iniciado pode ser enviado após a atribuição. É necessária coordenação durável dos envios antes de ativar o recurso em produção.
- Validar o acionamento automático para novas notas e para notas liberadas da revisão administrativa, incluindo a recuperação do primeiro responsável inativo.
- Validar a descrição de serviço de notas importadas por XML e por criação manual, incluindo notas anteriores à migration.
