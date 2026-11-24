-- Somente leitura. Execute no banco isolado após migrate deploy e guarde contagens.
SELECT count(*) AS notas,
       count(*) FILTER (WHERE "documentType" = 'NFSE') AS nfse,
       count(*) FILTER (WHERE "documentType" IS NULL) AS tipo_a_revisar
FROM "Invoice";

SELECT count(*) AS divergencias_xml_nfse
FROM "Invoice" i
WHERE i."documentType" = 'NFSE' AND length(i."xmlOriginal") > 0
  AND NOT EXISTS (
    SELECT 1 FROM "FiscalDocumentVersion" v WHERE v."invoiceId" = i.id
      AND v.state = 'CURRENT' AND v.xml = i."xmlOriginal"
      AND v."contentHash" = encode(sha256(convert_to(i."xmlOriginal", 'UTF8')), 'hex')
  );

SELECT count(*) AS divergencias_valor_nfse FROM "Invoice"
WHERE "documentType" = 'NFSE'
  AND "referenceValue" IS DISTINCT FROM coalesce("valorServico", "valorLiquido", "valorBaseCalculo");

SELECT count(*) AS ciclos, count(*) FILTER (WHERE "currentInvoiceId" IS NOT NULL) AS ciclos_vigentes,
       count(*) FILTER (WHERE "documentVersionId" IS NULL) AS ciclos_sem_xml_versionado
FROM "InvoiceWorkflow";

SELECT count(*) AS tarefas FROM "InvoiceWorkflowTask";
SELECT count(*) AS decisoes FROM "WorkflowCommand";
SELECT count(*) AS historicos FROM "NoteStatusHistory";

-- Guardar IDs internamente para amostragem. Os valores destas linhas não foram presumidos.
SELECT id FROM "Invoice" WHERE "documentType" IS NULL ORDER BY id LIMIT 100;
