# Revisão do planejamento NF-e/CT-e

Análise estática do checkout e da especificação nesta conversa. Sem acesso aos contratos externos, execução de integrações ou validação fiscal. Os casos de documentos abaixo são decisões de cobertura a confirmar com exemplos e documentação, não uma afirmação de suporte obrigatório.

Atualização após respostas da Fase 0: o usuário confirmou aguardar configuração quando não há workflow publicado, exigências configuráveis por tipo, revisão de valor zero/mês anterior nos três tipos, entrada dos novos tipos só por integração e destino Minerion/Delphi com executor `rpa-web`. Documentação externa fica pendente por orientação. Essas decisões prevalecem sobre as dúvidas originais abaixo; ver regras confirmadas em `spec.md` e andamento em `f0-contracts.md`.

## Avaliação

Permissões e reabertura também alinhadas: somente ADMIN altera dados operacionais pós-aprovação com motivo; ADMIN reabre recusadas com novo ciclo na versão publicada mais recente; consulta reaproveita vínculos/atribuições e limita a concessão global de workflow ao tipo configurado. Ver DR-19 a DR-21 e AC-31 a AC-33. Pendências restantes estão consolidadas na matriz de entregáveis de `f0-contracts.md`.

Decisões posteriores: autocadastro de fornecedor pelo XML; recebimento sem empresa única cadastrada/ativa aguarda ADMIN; alteração material após aprovação e antes do envio exige reaprovação desde o início, usando a versão publicada mais recente do tipo na criação do ciclo. `InvoiceWorkflow.invoiceId` hoje é único e a elegibilidade de encaminhamento rejeita nota que já tem workflow; a reaprovação requer evolução explícita de ciclos/histórico, sem apagar evidências anteriores. Dados de lançamento ficam bloqueados durante envio/resultado incerto. Cancelamento conhecido impede novos envios e, se lançado, exige reconciliação manual pelo ADMIN sem estorno automático. Essas decisões prevalecem sobre as questões originais abaixo; o contrato externo continua pendente.

Decisões adicionais confirmadas: cobertura somente de compras/fretes contratados pelas empresas; vínculos CT-e/NF-e informativos, com aprovações independentes; encaminhamento do estoque que aguardava configuração por seleção do ADMIN após publicar o primeiro workflow. Esses pontos resolvem parte de R-1, R-4 e R-10. Associação técnica à empresa, campos externos e demais situações fiscais continuam pendentes.

O plano cobre as etapas principais, mas ainda não é executável: falta definir elegibilidade, contratos de recuperação e consequências da expansão sobre consumidores existentes. A ordem das fases é adequada se a Fase 0 entregar as decisões abaixo antes de schema e código. As recomendações permanecem propostas até alinhamento.

## Prioridade alta — fechar antes de implementar

### R-1: workflow ausente e isolamento por tipo

Evidência: `src/lib/workflow/start.ts` consulta NFSE fixamente e retorna `LEGACY` quando não há workflow ativado/versão ativa. O catálogo em `src/lib/workflow/field-catalog.ts` inclui avaliação de serviço e tributos de NFS-e.

Lacuna: DR-7 pressupõe configuração publicada, mas não define o que acontece sem ela. Também faltam regras para responsável inativo, publicação enquanto documentos estão em andamento e obrigatoriedades incompatíveis com outro tipo.

Recomendação: NF-e/CT-e sem configuração publicada aguardarem configuração, sem cair silenciosamente em aprovação legada. Preservar a versão da execução e validar o catálogo por tipo. Decidir recusa/reabertura, correção após aprovação e substituição de aprovador indisponível.

### R-2: destino e estados de processamento

Evidência: `src/app/api/notas/[id]/workflow/complete/route.ts` define `APROVADO` e `PROCESSANDO` ao concluir a última etapa. `Invoice` possui campos `*Delphi` e a consulta `LANCADAS` em `src/lib/invoice-query.ts` também usa `dataLancamentoDelphi`.

Lacuna: não está estabelecido se Delphi e Minerion são o mesmo destino operacional nem quais consumidores externos buscam documentos nesses estados. Um coletor antigo pode receber tipos que não entende.

Recomendação: mapear os consumidores antes da ativação; definir destino e seleção por tipo, reserva de trabalho, expiração da reserva e proteção contra confirmação por trabalhador antigo. Separar conceitualmente aprovação, trabalho disponível, trabalho reservado, sucesso e resultado incerto, sem impor novos nomes de status antes de fechar o contrato. Reservas no banco não garantem sozinhas ausência de duplicidade no destino.

### R-3: timeout após lançamento e falhas entre sistemas

Lacuna: Minerion pode concluir e a resposta ou a atualização da plataforma falhar. A frase “reprocessamento idempotente” não define como provar que o lançamento já ocorreu.

Recomendação: acordar identificador estável da operação, referência externa e consulta/reconciliação. Reenvio automático depende de idempotência demonstrada no destino. Se não houver prova, manter resultado incerto para reconciliação autorizada. Persistir tentativas, versão/hash do payload, horários e resultado sem segredos. Não manter transação de banco aberta durante chamada externa ou automação de tela.

### R-4: elegibilidade e situação fiscal

Evidência: `Invoice.situacaoNotaFiscal` tem default `AUTORIZADA`. O escopo exclui tratamento completo de eventos.

Lacuna: reconhecer o XML não prova elegibilidade para lançar. É preciso definir cobertura de versões/modelos, ambientes de teste/produção, resumo versus XML completo, ausência de protocolo, documentos cancelados, devolução/complemento/substituição e documentos de saída. Também falta decidir o comportamento quando a fonte informar cancelamento depois da aprovação ou lançamento.

Recomendação: registrar o estado informado pela fonte, sem prometer validação SEFAZ. Tipos/situações não cobertos devem ter destinação explícita. Definir política mínima para cancelamento conhecido e sua limitação de atualização, mesmo com eventos completos fora de escopo. Não herdar automaticamente o default de autorização para documentos sem evidência exigida pelo contrato.

### R-5: identidade, empresa e conflito de conteúdo

Evidência: `Invoice.codigoIdentificador` é globalmente único. `create-invoice.ts` consulta existência antes de criar; efeitos como envio ao OneDrive ocorrem antes da transação de criação.

Lacuna: falta distinguir identidade fiscal, recebimento pela fonte, empresa que está gerindo o documento e operação de lançamento. A mesma chave pode aparecer em coletas/empresas diferentes ou com conteúdo diferente.

Recomendação: definir essas identidades separadamente; a fonte não deve criar uma segunda identidade fiscal. Aplicar unicidade no banco e tratar conflito de concorrência. Reenvio equivalente não repete notificações nem reinicia workflow. Mesma chave com conteúdo materialmente diferente exige conflito rastreável, sem sobrescrever dados aprovados. Definir se várias empresas podem gerir o mesmo documento, por quais papéis, e como isso afeta a unicidade operacional.

### R-6: coleta sem perdas e recuperação antes da criação da nota

Lacuna: “checkpoint ou paginação” não cobre página parcialmente processada, falha após download, cursor expirado, itens tardios, indisponibilidade, limite de requisições ou dois coletores simultâneos. AC-3 prevê falha antes de existir uma nota, mas não define onde ela fica consultável.

Recomendação: manter recebimento/falha durável independente da nota e permitir retomada. Avançar cursor apenas após guardar duravelmente o trabalho necessário; um item inválido não pode desaparecer nem bloquear silenciosamente todos os demais. Definir checkpoint por escopo da fonte, retentativas limitadas, espera progressiva, retomada manual e reconciliação de lacunas. Não assumir contrato de NSU da NFS-e para FSist.

### R-7: significado dos valores e mapeamentos de lançamento

Evidência: `src/app/api/relatorios/financeiro/route.ts` soma `valorServico`; o modelo possui valores monetários com duas casas e catálogo específico de serviço.

Lacuna: não foi definido valor exibido/aprovado/pago, composição por itens, frete, descontos, parcelas, retenções e totais. Produtos podem depender de cadastros externos e regras de lançamento não presentes no XML.

Recomendação: produzir matriz campo XML → dado persistido → tela/aprovação → campo Minerion, incluindo unidades, precisão decimal, arredondamento, datas/fuso, campo ausente versus zero e origem de dados complementares. Confirmar cadastros obrigatórios (produto, fornecedor, natureza, unidade, centro de custo e outros exigidos pelo contrato) sem inventar padrões. Divergências devem ter resolução explícita. Não reutilizar `valorServico` apenas para fazer os novos totais aparecerem.

## Prioridade média — incluir nos critérios de entrega

- **R-8 — Autorização e vínculos:** `workflow/access.ts` concede consulta global de NFSE e `invoice-query.ts` combina fornecedor, tarefas e alcance de consulta. Acesso global de NFS-e não pode ser ampliado implicitamente para NF-e/CT-e. Definir permissão por empresa, tipo e papel em detalhe, XML, exportação e relações CT-e/NF-e; uma chave relacionada não concede acesso ao documento. Determinar emitente/fornecedor e empresa a partir dos papéis corretos, sem tratar o tomador como destinatário universal.
- **R-9 — Revisão administrativa e alterações:** `create-invoice.ts` aciona revisão antes do workflow e usa dados orientados a NFS-e. Decidir se regras de nota antiga/valor zero se aplicam aos novos tipos e em que valor. Definir campos operacionais editáveis, bloqueio de edição durante envio e necessidade de nova aprovação quando houver mudança material. Manter XML original e dados fiscais separados de ajustes operacionais.
- **R-10 — Relações CT-e/NF-e:** confirmar múltiplas referências, referência sem nota importada, nota chegando depois e relação entre empresas. Armazenar chave ausente sem criar documento fictício; definir resolução posterior e efeitos em totais. Somar frete e nota de produto indiscriminadamente pode duplicar componentes financeiros; a semântica deve ser acordada para relatórios atuais.
- **R-11 — Superfícies esquecidas:** além de listagem/detalhe, revisar dashboard, relatórios existentes, exportações, e-mails/lembretes, revisão administrativa, filtros, indicadores, download do XML, ações em lote e criação manual/por fornecedor. Não são relatórios novos: é compatibilidade do que já existe com os novos tipos.
- **R-12 — XML e capacidade:** definir layouts/namespaces e envelopes aceitos, versão desconhecida, limites de bytes/itens/tempo e proteção contra entidades externas e expansão de conteúdo. Dimensionar XMLs e históricos sem carregá-los em listagens. Coleta e automação longa exigem executor compatível com limites Vercel; explicitar onde roda, como autentica e quem opera. Definir retenção, acesso e cópia de segurança.
- **R-13 — Migração e ativação:** migração aditiva e compatível com consumidores antigos, preenchimento de tipos legados com evidência, índices e volume; ativar separadamente coleta, gestão e envio por tipo/empresa. Parar novos envios não desfaz lançamento já realizado. Definir rollback operacional/reconciliação e evitar remoção destrutiva de registros novos.
- **R-14 — Operação:** métricas de última coleta bem-sucedida, atraso, backlog, erros por fase/tipo/empresa e lançamentos incertos; definir responsáveis, limites de retentativa e ação manual auditada. Homologação deve ser isolada do envio real.

## Cenários adicionais propostos

Cada linha expande os cenários da especificação; depende da decisão funcional indicada acima.

| ID | Dado / Quando | Então esperado proposto | Risco |
|---|---|---|---|
| AC-7 | Dois recebimentos simultâneos do mesmo documento | Um registro operacional conforme a identidade definida; sem tarefa/e-mail duplicado | R-5 |
| AC-8 | Mesma chave com conteúdo materialmente diferente após aprovação | Conflito rastreável, sem sobrescrita nem envio silencioso | R-5, R-9 |
| AC-9 | Fonte falha no meio de uma página e coleta reinicia | Nenhum item perdido; itens duráveis retomados sem efeitos duplicados | R-6 |
| AC-10 | Minerion conclui, mas há timeout ou falha ao confirmar na plataforma | Resultado incerto reconciliável; sem reenvio cego | R-3 |
| AC-11 | Dois executores tentam lançar; um perde a reserva e retorna atrasado | Confirmação antiga não altera trabalho mais recente; duplicidade externa protegida pelo contrato do destino | R-2, R-3 |
| AC-12 | Tipo sem workflow publicado ou gestor inativo | Documento permanece em situação identificável sem aprovação/liberação involuntária | R-1 |
| AC-13 | Nova versão publicada durante uma execução | Documento em andamento mantém versão; novo documento usa versão aplicável ao seu tipo | R-1 |
| AC-14 | Usuário com consulta global apenas de NFS-e consulta NF-e/CT-e ou vínculo relacionado | Acesso segue escopo autorizado, inclusive XML/exportação | R-8 |
| AC-15 | XML desconhecido, incompleto, de teste ou situação não suportada | Destinação definida, rastreabilidade e ausência de lançamento indevido | R-4, R-12 |
| AC-16 | Cancelamento é informado antes ou depois do lançamento | Política acordada bloqueia envio ou encaminha reconciliação, preservando histórico | R-4 |
| AC-17 | CT-e chega antes de uma ou várias NF-e relacionadas | Referências preservadas; resolução posterior respeita autorização e regra de totalização | R-10 |
| AC-18 | Documento aprovado muda materialmente ou é recusado durante tentativa de envio | Conflito/transição seguem política explícita; payload e decisão são rastreáveis | R-2, R-9 |
| AC-19 | Itens têm frações, descontos e parcelas com arredondamento | Valores respeitam precisão e política acordadas; tela e Minerion reconciliam | R-7 |
| AC-20 | Exportação, relatório, e-mail e dashboard misturam os tipos | Valores, rótulos, filtros e permissões seguem a mesma semântica por tipo | R-7, R-11 |
| AC-21 | Integração antiga busca notas após ativação dos novos tipos | Recebe apenas tipos/destinos compatíveis com seu contrato | R-2, R-13 |
| AC-22 | Ativação é suspensa após lançamentos já concluídos | Novos envios param; resultados anteriores permanecem consultáveis e reconciliáveis | R-13 |

## Ajuste recomendado às fases

1. Fechar R-1 a R-7 e a matriz de contratos na Fase 0, com exemplos anonimizados e documentação fornecidos pelo usuário.
2. Acrescentar na Fase 1 recebimento durável independente da nota, precisão dos dados, unicidade concorrente e efeitos transacionais.
3. Validar perda/retomada da coleta na Fase 2 antes de aumentar volume.
4. Cobrir todas as superfícies e fronteiras de autorização na Fase 3, incluindo relatórios atuais e integrações antigas.
5. Demonstrar reconciliação e recuperação do destino na Fase 4 antes de habilitar envio automático.
6. Validar cenários de falha e regressão em cada fase; reservar a Fase 5 para ponta a ponta, migração, carga proporcional ao volume e ativação gradual.
