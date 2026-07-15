# Controle de NSUs ADN/NFS-e — API e monitoramento

## Objetivo

Esta etapa cria a persistência e os endpoints para receber registros de NSU produzidos por um serviço consumidor externo, além de exibir o acompanhamento na tela de empresas.

## Escopo desta etapa

A aplicação apenas recebe, valida, persiste e disponibiliza consultas sobre tentativas, estado atual de NSUs e checkpoints informados pelo consumidor.

Esta etapa **não implementa** download de notas, consulta ao ADN, processamento de XML, controle de janela, cálculo de checkpoints, reprocessamento, jobs, retentativas ou ações administrativas.

## Modelo de dados

### `NfseNsuCheckpoint`

- `id`
- `companyId`
- `cnpj`
- `lastContiguousNsu`
- `highestScannedNsu`
- `lastScanAt`
- `lastDocumentDownloadedAt`
- `version`
- `createdAt`
- `updatedAt`

### `NfseNsuControl`

- `id`
- `companyId`
- `cnpj`
- `nsu`
- `status`
- `attempts`
- `firstAttemptAt`
- `lastAttemptAt`
- `lastHttpStatus`
- `lastError`
- `documentId`
- `accessKey`
- `ignoreReason`
- `wasLastAttemptScanned`
- `createdAt`
- `updatedAt`

### `NfseNsuAttempt`

- `id`
- `nsuControlId`
- `idempotencyKey`
- `resultStatus`
- `httpStatus`
- `errorMessage`
- `wasNsuScanned`
- `documentId`
- `accessKey`
- `ignoreReason`
- `attemptedAt`
- `createdAt`

## Status dos NSUs

- `Downloaded`: documento encontrado e processado pelo consumidor.
- `PendingGap`: NSU consultado, mas documento indisponível no momento.
- `RetryError`: erro técnico informado pelo consumidor.
- `IgnoredByRule`: documento encontrado e ignorado por regra do consumidor.

Para relatórios, `Downloaded` e `IgnoredByRule` são resolvidos; `PendingGap` e `RetryError` são pendentes.

## Endpoints de gravação

### `POST /api/nfse/nsu/attempts`

Registra uma tentativa de NSU de forma idempotente. Para integrações, reutiliza o header `x-api-key` validado contra `INVOICE_INGEST_API_KEY`, o mesmo segredo já usado no ingest de notas.

Exemplo:

```json
{
  "idempotencyKey": "31096483000101-102-20260714T130000Z",
  "companyId": "company-31096483000101",
  "cnpj": "31096483000101",
  "nsu": 102,
  "status": "PendingGap",
  "attemptedAt": "2026-07-14T13:00:00.000Z",
  "wasNsuScanned": true,
  "httpStatus": 404,
  "errorMessage": null,
  "documentId": null,
  "accessKey": null,
  "ignoreReason": null
}
```

Resposta:

```json
{
  "id": "control-id",
  "attemptId": "attempt-id",
  "idempotent": false,
  "companyId": "company-31096483000101",
  "cnpj": "31096483000101",
  "nsu": 102,
  "status": "PendingGap",
  "attempts": 1
}
```

## Endpoints de checkpoint

Os endpoints de escrita de checkpoint também reutilizam `x-api-key` com `INVOICE_INGEST_API_KEY` ou sessão administrativa.


- `GET /api/nfse/nsu/checkpoints/{companyId}`
- `PUT /api/nfse/nsu/checkpoints/{companyId}`
- `GET /api/nfse/nsu/checkpoints/by-cnpj/{cnpj}`
- `PUT /api/nfse/nsu/checkpoints/by-cnpj/{cnpj}`

Atualização:

```json
{
  "lastContiguousNsu": 101,
  "highestScannedNsu": 105,
  "lastScanAt": "2026-07-14T13:00:00.000Z",
  "lastDocumentDownloadedAt": "2026-07-14T12:59:48.000Z",
  "expectedVersion": 12
}
```

A API valida valores não negativos, `lastContiguousNsu <= highestScannedNsu`, impede redução e aplica concorrência otimista por `expectedVersion`.

## Endpoints de consulta

- `GET /api/companies/{companyId}/nfse/nsu-summary`
- `GET /api/companies/{companyId}/nfse/nsus`
- `GET /api/companies/{companyId}/nfse/nsus/{nsu}/attempts`

A listagem de NSUs é paginada e permite filtros por status, faixa de NSU, datas, tentativas mínimas, somente gaps, somente erros e somente resolvidos.

## Endpoints de relatório

- `GET /api/nfse/nsu/reports/companies`
- `GET /api/nfse/nsu/reports/dashboard`
- `GET /api/nfse/nsu/reports/integrity`

O relatório de empresas retorna uma linha por empresa com contadores por status, checkpoints, pendências e situação de processamento.

## Regras de idempotência

`idempotencyKey` é única. Reenvio com o mesmo conteúdo retorna o registro existente sem criar histórico nem incrementar tentativas. Reenvio com conteúdo diferente retorna `409 Conflict`.

## Regras de concorrência

Checkpoint usa `version`. A atualização só ocorre quando `expectedVersion` é igual à versão atual. Criação exige `expectedVersion = 0`.

## Validações

- CNPJ obrigatório com 14 dígitos e vinculado à empresa.
- NSU inteiro não negativo.
- Status permitido pelo enum.
- Campos específicos por status.
- Mensagens de erro são truncadas e não devem conter dados sensíveis.

## Índices

- `NfseNsuCheckpoint(companyId)` único.
- `NfseNsuCheckpoint(cnpj)` único.
- `NfseNsuControl(companyId, nsu)` único.
- Índices por empresa, status e datas de tentativa.
- `NfseNsuAttempt(idempotencyKey)` único.
- Índices por controle/data e status/data.

## Relacionamento com empresas

O controle é por `Company.id`, mantendo `cnpj` como cópia auditável. O CNPJ recebido precisa coincidir com `Company.cnpj`.

## Alterações no frontend

A tela de empresas passa a exibir um resumo compacto de NFS-e na listagem. Ao editar uma empresa, aparece a seção “Processamento de NFS-e” com cards, filtros, tabela paginada de NSUs e modal de histórico.

## Como interpretar indicadores

`checkpointDistance` é `highestScannedNsu - lastContiguousNsu`. Ele indica distância entre checkpoints e **não** representa quantidade real de gaps.

## Como identificar gaps

Filtre a tabela por `PendingGap` ou use “Somente gaps”.

## Como identificar erros

Filtre a tabela por `RetryError` ou use “Somente erros”.

## Como identificar empresas nunca processadas

Empresas sem checkpoint e sem controles aparecem como `NeverScanned`.

## Como identificar NSUs posteriores processados após um gap

A listagem retorna `hasLaterResolvedNsus`, indicando que existe NSU posterior resolvido para a mesma empresa.

## Limitações desta etapa

A API não decide janelas, não calcula próximo NSU, não valida sequência completa e não corrige checkpoints automaticamente.

## Responsabilidades do serviço consumidor futuro

O consumidor externo continuará responsável por consultar ADN/NFS-e, decidir NSUs, controlar janelas, calcular checkpoints, reprocessar gaps, baixar documentos, persistir/processar XML e informar os resultados à API.
