# Contingência: retornar notas ao fluxo legado

Este procedimento permite interromper o workflow de NFS-e sem apagar notas nem reverter migrations. Há duas ações independentes:

1. **Parar novas entradas:** desativar a versão publicada. Notas criadas depois disso usam o fluxo legado.
2. **Retirar notas já encaminhadas:** apagar somente a execução e os artefatos operacionais do workflow das notas escolhidas. A nota e seus registros de auditoria permanecem; estando pendente e elegível, ela volta a aparecer no fluxo legado.

Use um cliente PostgreSQL conectado ao banco correto. Faça backup recente antes de executar exclusões. O script abaixo protege o modo de prévia com `ROLLBACK` e exige uma confirmação textual para efetivar alterações.

## 1. Interromper novas entradas

Execute:

```sql
BEGIN;

UPDATE "ApprovalWorkflow"
SET "activeVersionId" = NULL,
    "activatedAt" = NULL,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "documentType" = 'NFSE';

-- Confira a linha afetada. Para aplicar, troque ROLLBACK por COMMIT.
ROLLBACK;
```

Com `ROLLBACK`, nada é alterado. Para aplicar, troque a última linha por `COMMIT`. A versão publicada e suas configurações continuam guardadas, podendo ser ativadas novamente pela tela de configuração.

## 2. Retirar notas específicas do workflow

Identifique as notas pelo `codigoIdentificador` (preferível) ou ajuste o filtro para usar IDs internos. Informe os identificadores em `VALUES`. A consulta mostra exatamente quais notas e execuções seriam removidas. Ela só aceita notas ainda pendentes, não processadas, e execuções `ACTIVE` ou `BLOCKED`; notas concluídas devem ser tratadas individualmente.

Rode primeiro com `ROLLBACK`. Revise as linhas retornadas. Para aplicar, substitua **as duas ocorrências** de `ROLLBACK` por `COMMIT` e execute novamente.

```sql
BEGIN;

CREATE TEMP TABLE rollback_workflow_targets ON COMMIT DROP AS
SELECT i."id" AS "invoiceId", i."codigoIdentificador", i."numeroNota", w."id" AS "executionId", w."status" AS "workflowStatus"
FROM "Invoice" i
JOIN "InvoiceWorkflow" w ON w."invoiceId" = i."id"
WHERE i."codigoIdentificador" IN (
  'SUBSTITUA-PELO-CODIGO-IDENTIFICADOR'
)
  AND i."status" = 'AGUARDANDO_APROVACAO'
  AND i."processada" = FALSE
  AND i."statusProcessamento" = 'PENDENTE'
  AND w."status" IN ('ACTIVE', 'BLOCKED');

-- Prévia: confirme que todos os identificadores esperados aparecem.
SELECT * FROM rollback_workflow_targets ORDER BY "codigoIdentificador";

-- Remoção das dependências operacionais, respeitando as FKs RESTRICT.
DELETE FROM "WorkflowNotificationAttempt" a
USING "WorkflowNotification" n, "InvoiceWorkflowTask" t, rollback_workflow_targets x
WHERE a."notificationId" = n."id"
  AND n."taskId" = t."id"
  AND t."executionId" = x."executionId";

DELETE FROM "WorkflowNotification" n
USING "InvoiceWorkflowTask" t, rollback_workflow_targets x
WHERE n."taskId" = t."id"
  AND t."executionId" = x."executionId";

DELETE FROM "WorkflowCommand" c
USING rollback_workflow_targets x
WHERE c."executionId" = x."executionId";

DELETE FROM "InvoiceWorkflowTask" t
USING rollback_workflow_targets x
WHERE t."executionId" = x."executionId";

DELETE FROM "InvoiceWorkflow" w
USING rollback_workflow_targets x
WHERE w."id" = x."executionId";

-- Os logs de auditoria da nota são preservados de propósito.
SELECT "codigoIdentificador", "numeroNota" FROM rollback_workflow_targets ORDER BY "codigoIdentificador";

-- Prévia: desfaça. Aplicação: troque por COMMIT.
ROLLBACK;
```

Após o `COMMIT`, as notas permanecem com status `AGUARDANDO_APROVACAO`; sem execução ativa, voltam a ser tratadas pelas consultas do fluxo legado. Se o mecanismo legado depender da sincronização de gestores, use **Sincronizar gestores** no painel administrativo após confirmar os vínculos dos fornecedores. O envio de e-mails legado é uma ação separada e não é disparado por este procedimento.

## Escopo e limites

- Não apague as tabelas da migration `20261031120000_approval_workflow` nem reverta essa migration em um banco compartilhado: isso removeria configurações e registros do workflow e pode causar incompatibilidade entre aplicação e schema.
- O procedimento não remove notas nem `NoteAuditLog`; apaga tarefas, comandos e notificações pertencentes às execuções selecionadas.
- Não inclui notas `COMPLETED`, notas já aprovadas/processadas, nem notas retidas por revisão administrativa. Avalie esses casos manualmente antes de qualquer alteração.
- A ação é por nota e não é reversível depois do `COMMIT` sem restaurar dados do backup.
