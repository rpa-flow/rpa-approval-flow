# Plano de implementação: workflow NFS-e com configuração por tipo

Data: 31/10/2026. Estado: planejamento para revisão. Código da aplicação não alterado.

Fonte de requisitos: [spec.md](spec.md). Contexto compartilhado: [task-brief.md](task-brief.md).

## Resultado esperado

ADMIN publica um fluxo NFS-e com etapas ordenadas, um gestor fixo por etapa e políticas dos campos existentes. Cada nota executa uma versão; cada etapa autorizada avança uma vez; a última libera o processamento. Atribuições geram e-mails persistidos, e ações/configurações ficam auditáveis. A modelagem contém o tipo do documento para extensões futuras, mas CT-e/produto não recebem parser, telas ou execução nesta entrega.

## Arquitetura proposta

Separar responsabilidades em módulos pequenos sob `src/lib/workflow/`: catálogo e políticas, consulta/autorização, execução/transições e notificações. Rotas validam contratos e chamam os mesmos serviços; páginas consomem metadados de etapa sem duplicar regras de negócio. Reutilizar Prisma, Zod, sessão, regras de pagamento, Microsoft Graph e componentes existentes. Não adotar motor BPM externo ou processo residente.

### Persistência

Os nomes são propostas; fechar nomes/campos e índices na F1 antes de dividir implementação entre backend/frontend.

| Entidade | Conteúdo e invariantes |
|---|---|
| `Invoice.documentType` | Tipo explícito, inicialmente enum com `NFSE`; valores futuros entram por evolução versionada. Backfill somente após verificar os dados legados. Layout Nacional/ABRASF permanece no detalhamento documental. |
| `ApprovalWorkflow` | Identidade por tipo, ponteiro de versão vigente e marco de ativação. Uma definição por tipo; ativação separada da simples existência das tabelas. |
| `ApprovalWorkflowVersion` | Número único por definição, rascunho/publicada, revisão para concorrência, autoria e publicação. Conteúdo publicado é imutável; versão antiga pode continuar em uso mesmo fora de vigência. |
| `ApprovalWorkflowStep` | Identidade, nome, ordem única na versão, gestor configurado e relação com políticas de campo. |
| `ApprovalStepFieldPolicy` | Chave de catálogo por etapa, modo oculto/leitura/edição e obrigatoriedade. Unicidade etapa/campo; validação contra catálogo e capacidades fixas do campo. |
| `InvoiceWorkflow` | Uma execução por nota, versão fixada, etapa/tarefa atual, situação e revisão monotônica. Referenciar tarefa da própria execução; não usar `dataAtualizacao` como controle de concorrência. |
| `InvoiceWorkflowTask` | Etapa da versão, responsável efetivo, snapshots de identificação, atribuição/conclusão e decisão. Nesta entrega, uma passagem sequencial por etapa; não antecipar ciclos de devolução. |
| Eventos/auditoria | Reutilizar `NoteAuditLog` para eventos de nota, acrescentando correlação/execução/etapa quando necessário; auditoria de configuração precisa de entidade própria sem `invoiceId` obrigatório. Registrar diff e snapshots necessários. |
| `WorkflowCommand` ou equivalente | Chave idempotente, hash do payload, ator, ação e resultado, ligados à execução; restrição única para reconhecer retries. |
| `NotificationOutbox` | Evento/atribuição, destinatário registrado, payload, chave única de deduplicação, estado, disponibilidade e lease de processamento. |
| `NotificationAttempt` | Tentativa, horários, resultado, erro saneado e correlação externa quando disponível. Não sobrescrever as falhas anteriores. |

- Adicionar índices para fila do gestor, notas bloqueadas, situação/revisão da execução, auditoria cronológica e notificações devidas.
- Evitar exclusão em cascata no histórico novo; analisar compatibilidade do histórico existente e impedir a exclusão destrutiva conforme D5.
- Manter os enums e contratos de status/processamento da nota; estado da execução fica separado.
- Manter `ServiceEvaluation` como projeção corrente por nota para compatibilidade com relatórios. Auditoria preserva cada alteração e seu autor, sem criar avaliações históricas fictícias.

### Catálogo e formulários

Inventariar os campos NFS-e apresentados hoje no dashboard e no detalhe. O catálogo versionado em código terá chave estável, rótulo, tipo, agrupamento, origem, validação e capacidades de edição. ADMIN configura sua utilização por etapa, sem cadastrar novos campos.

- Dados fiscais originais: visibilidade configurável e leitura, sem liberar edição que hoje não existe.
- Dados operacionais: OC, contrato, parcelas, data de pagamento e campos de observação/avaliação conforme permissões e contratos atuais.
- Avaliação: preservar coerência dos subcampos e atribuir autoria ao gestor que a informou, não automaticamente ao último aprovador.
- Metadados essenciais para operar (identificação, situação, etapa, responsável e ações): definir como estrutura fixa da tela, fora da matriz de dados configuráveis.
- Políticas devem considerar dependências como OC **ou** contrato, e regras temporais de pagamento. Não transformar uma dependência entre campos em duas obrigatoriedades independentes.
- Definir política de ausência de uma chave no rascunho e normalizá-la ao publicar; não deixar comportamento implícito diferente no cliente e no servidor.

### Contratos propostos

Todos os nomes abaixo são novos contratos a fechar na F1, preservando respostas existentes e adicionando metadados onde possível.

| Contrato | Operação e autorização |
|---|---|
| `GET /api/workflows/field-catalog?documentType=NFSE` | Catálogo permitido, capacidades e dependências; configuração para ADMIN. |
| `GET /api/workflows?documentType=NFSE` | Versão vigente, rascunhos e histórico de versões; ADMIN. |
| `POST /api/workflows/:id/versions` | Criar rascunho novo ou a partir de versão, sem editar a publicada; ADMIN. |
| `PUT /api/workflows/:id/versions/:versionId` | Salvar etapas/políticas com revisão esperada; ADMIN. |
| `POST /api/workflows/:id/versions/:versionId/publish` | Validar configuração e atualizar ponteiro vigente atomicamente; ADMIN. |
| `GET /api/workflows/:id/audit` | Histórico de configuração, separado do histórico da nota; ADMIN. |
| `GET /api/notas/:id/workflow` | Versão, etapa atual, tarefas, política e ações permitidas; consulta conforme D1. |
| `PATCH /api/notas/:id/workflow/current-step` | Salvar somente campos editáveis, com revisão/idempotência; responsável atual. |
| `POST /api/notas/:id/workflow/current-step/complete` | Salvar campos e concluir atomicamente, com revisão/idempotência; responsável atual. |
| Consumidor interno autenticado da outbox | Reclamar lote devido, enviar e registrar tentativas; contrato adaptado ao acionador escolhido em D5. |

Exemplo conceitual de comando: `{ expectedRevision, idempotencyKey, fields }`. A resposta fornece nova revisão, tarefa/etapa atual, situação da execução, status da nota e situação da notificação; não exige `status: APROVADO` do cliente.

Consultas existentes recebem metadados aditivos como `workflowVersion`, `currentStep`, `currentAssignee`, `canEdit` e `canComplete`. Validar o formato final para não quebrar consumidores de `GET /api/notas` e listagens/exportações. Filtro de responsável deve distinguir responsável atual de validador final.

### Transação de conclusão

1. Autenticar ator e verificar política de acesso.
2. Reconhecer comando idempotente já confirmado; validar hash/ator antes de devolver resultado anterior.
3. Ler execução/tarefa e validar revisão esperada, responsável, revisão administrativa e campos autorizados.
4. Validar os requisitos da etapa; na última, validar invariantes finais com os valores persistidos mais os enviados.
5. Atualizar campos e avaliação com autoria correta, concluir tarefa, avançar ou finalizar e incrementar revisão por operação condicional.
6. Registrar comando, auditoria e, se houver nova atribuição, intenção de e-mail na mesma transação.
7. Registrar `NoteStatusHistory` quando houver mudança real de status. Avanços intermediários têm evento de etapa, mesmo com status da nota inalterado.
8. Confirmar e retornar; envio externo acontece depois do commit.

Usar comparação de revisão e unicidade de tarefa/evento/comando para resolver corrida. Publicação também precisa de controle de revisão do ponteiro vigente.

### E-mails e execução serverless

- Fila persistida no PostgreSQL, com consumidor autenticado em lotes limitados; nenhuma promessa de que uma Promise em segundo plano sobreviva ao encerramento da requisição.
- Chave única por evento de atribuição; guardar destinatário e conteúdo/correlação suficientes para auditar a intenção original.
- Reclamar trabalhos com lease/atualização condicional para impedir processamento concorrente comum. Expirar leases para recuperar interrupções.
- Falhas temporárias voltam à fila com espera progressiva e limite definido; falha definitiva/exaustão é visível ao ADMIN e pode ter reenvio controlado.
- Distinguir erro conhecido de resultado incerto (aceite externo possível antes de uma interrupção). Deduplicar eventos internos não garante entrega externa exatamente uma vez; registrar essa limitação.
- Se a tarefa já tiver sido superada antes do envio, preservar o envio de cada atribuição e informar no conteúdo que a nota já avançou. O link sempre consulta a situação atual e não autoriza ação antiga. Suprimir uma atribuição exigiria uma nova decisão de negócio, pois a regra confirmada exige e-mail a cada alteração de responsável.
- Reutilizar o template Graph, mas propagar resultado de simulação/aceite até o consumidor. Não marcar simulado como aceito em produção.
- Lembretes/reenvios usam a atribuição atual; regra de lembrete desativada por fornecedor não deve desligar silenciosamente o e-mail obrigatório da nova tarefa.

## Fases de implementação

| Fase | Entrega | Dependências | Evidência para concluir |
|---|---|---|---|
| **F0 — Fechar compatibilidade e implantação** | Resolver D1–D6, inventariar campos e consumidores, aprovar tratamento de notas antigas, revisão administrativa, ações existentes e recuperação de gestor inativo. Registrar desenho mínimo das telas e tabela campo/etapa de um exemplo. | Revisão desta proposta. | Matriz de decisões fechada, exemplo com dois gestores, baseline e mapa de rotas que escrevem status/processamento. |
| **F1 — Dados, catálogo e contratos** | Models/migration aditivos, restrições/índices, catálogo NFS-e, validações e DTOs de configuração/execução. Ativação permanece desligada. | F0 para políticas de dados/acesso. | Migration ensaiada em banco isolado novo e cópia representativa sem dados sensíveis; Prisma gera; contratos e catálogo revisados. DR-1/3/4/8/18. |
| **F2 — Execução e auditoria** | Publicação versionada, início de execução, tarefas, campos, autorização, idempotência/concorrência e finalização. Integrar criação, revisão administrativa e guardas nas rotas antigas. Auditoria e criação da outbox atômicas. | F1. | Verificações de AC-1–11 e AC-13–16 pertinentes ao backend, com corrida real em PostgreSQL; nenhuma rota pula etapas. |
| **F3 — Notificações confiáveis** | Consumidor/acionador, tentativas/leases/retry, resultado Graph/simulação e adaptação de lembretes/reenvios. Visibilidade de falhas para ADMIN. | F2; escolha operacional de D5. | AC-12 e AC-16: erro, retry, interrupção, dois consumidores, simulação e destinatário atual verificados. |
| **F4 — Configuração administrativa** | Área de workflows em Configurações, seletor inicialmente NFS-e, rascunho, reordenação acessível, gestor por etapa, matriz de campos, prévia, publicação, versões e auditoria de configuração. | Contratos F1; APIs F2. | AC-1/2/13/15 pela interface; estados vazios/erro/conflito; teclado e mobile; publicada protegida contra edição. |
| **F5 — Operação do gestor** | Fila/tarefa atual, responsável e progresso; formulário compartilhado entre dashboard/detalhe; salvar/concluir; política visual nas superfícies da nota; histórico e mensagens de conflito/notificação pendente. | F2/F3; catálogo F1. | AC-3–10/14/16 nas duas entradas de aprovação; campo futuro não impede etapa atual; dados continuam nas consultas/exportações autorizadas. |
| **F6 — Integração e revisão independente** | Regressão do legado, fluxo completo, contratos RPA/Delphi, relatório/exports, revisão da auditoria e requisitos. Correções limitadas ao escopo. | F3/F4/F5. | Checklist DR/AC com evidências, lint/build e verificações focadas; limitações declaradas; ensaio de ativação/reversão. |
| **F7 — Ativação controlada** | Publicar fluxo inicial real, validar gestores/campos, agendamento e destinatários, ativar NFS-e no corte aprovado e acompanhar primeira execução. | F6 e ambiente/autorizações de publicação disponíveis. | Nota piloto percorre etapas e só então aparece para processamento; notificações reais aceitas e auditoria reconciliada; bloqueios/falhas monitoráveis. |

Fases são marcos de entrega, não autorização implícita para executar. Este pedido entrega somente documentação. Execução posterior seguirá o escopo que o usuário autorizar; não presumir implantação de produção.

### Arquivos e áreas afetados por fase

| Área | Caminhos atuais / propostos |
|---|---|
| Persistência e validação | `prisma/schema.prisma`, migration versionada nova, `src/lib/validations.ts`, novo `src/lib/workflow/` |
| Identificação e início | `src/app/api/notas/create-invoice.ts`, `src/lib/nfse-parser.ts` apenas se necessário para identificação, sem alterar parsing fiscal lateralmente |
| Autorização e consultas | `src/lib/auth.ts`, `src/lib/invoice-query.ts`, `src/lib/invoice-detail-response.ts`, rotas de detalhe, minhas, export e histórico; manter escopo atual dos relatórios salvo D1 |
| Escritas e revisão | `src/app/api/notas/[id]/route.ts`, `.../[id]/comunicacao/route.ts`, `.../[id]/revisao/route.ts`, `src/app/api/notas/recusadas/route.ts` para compatibilidade, novas rotas de workflow |
| E-mails e jobs | `src/lib/email.ts`, `src/app/api/notas/lembretes/route.ts`, `src/app/api/notificacoes/aprovacao/route.ts`, consumidor e configuração de acionamento a definir |
| Interface administrativa | `src/app/configuracoes/page.tsx`, proposta `src/app/configuracoes/workflows/page.tsx`, componentes pequenos de editor/matriz/prévia e navegação existente |
| Interface operacional | `src/app/dashboard/page.tsx`, `src/app/notas/[id]/page.tsx`, formulário/política compartilhados sob componentes do domínio |
| Histórico/relatórios | `src/app/api/notas/[id]/historico/route.ts`, `src/lib/reports.ts` e agregações apenas no necessário para manter autoria/status/SLA compatíveis |
| Documentação | `README.md`, contrato das novas APIs, operação de notificações e checklist de migração/ativação |

### Responsabilidade de implementação

O coordenador mantém contratos e especificação. Se houver delegação, usar `.agents/architect.md` para validar contratos; `.agents/backend.md` para persistência/domínio/APIs; `.agents/frontend.md` e `.agents/designer.md` para telas e acessibilidade; `.agents/qa.md` para revisão de aceite após existir entrega verificável.

Um único responsável por vez por `schema.prisma`, contratos compartilhados, layouts e `package.json`. Frontend pode avançar em componentes separados após F1; não paralelizar alterações nas mesmas rotas. QA deve fornecer evidências proporcionais ao risco; o planejamento já recebeu uma revisão arquitetural estática independente.

## Estratégia de verificação

- **Baseline:** registrar revisão do checkout, alterações preexistentes e diagnósticos disponíveis. Não sobrescrever `tsconfig.tsbuildinfo` já modificado pelo usuário.
- **Domínio:** verificações focadas de ordem, política, requisitos entre campos, data, autoria da avaliação, invariantes finais e estados bloqueados.
- **Persistência real isolada:** migração em dados representativos, publicação simultânea, dupla conclusão, ingestão repetida, liberação administrativa concorrente e rollback com falha de auditoria/outbox. Mocks isolados não comprovam concorrência no banco.
- **Contratos/autorização:** responsável com/sem vínculo conforme D1, outros gestores, ADMIN e integração; todas as rotas de status/processamento; consultas, XML e exportação preservam a semântica de ocultação apenas visual.
- **E-mails:** falha conhecida, resultado incerto, lease expirado, retry, simulação, falha definitiva, lembretes após avanço e ausência de reenvio ao gestor antigo.
- **Interface:** dashboard e detalhe usam a mesma política e validação; teste de tela pequena/teclado; estados vazio, indisponível, conflito, erro por campo e tarefa concluída.
- **Regressão:** nota legada, revisão administrativa, avaliação/relatórios, pagamento, importação e processamento após conclusão. Não incluir CT-e/produto na validação de entrega.
- **Comandos disponíveis:** `npm run prisma:generate`, `npm run lint`, `npm run build` quando a implementação existir. Confirmar o executor dos arquivos de teste focados antes de definir comandos adicionais; não há `npm test` configurado.
- Comandos Prisma que carreguem configuração/ambiente e ensaios de banco precisam ser executados conforme os guardrails do projeto, sem ler/expor `.env`/`.env.local` nem tocar banco real implicitamente.

Nesta entrega de planejamento, não executar build, migrations, envio real ou scripts que precisem de banco. A evidência é inspeção estática, revisão arquitetural e validação do diff documental.

## Ativação e reversão

1. Aplicar expansão de schema e publicar código compatível com notas sem execução, com ativação desligada.
2. Ensaiar fluxo completo em ambiente isolado e validar as decisões F0 no procedimento operacional.
3. Configurar/publicar versão NFS-e; revisão administrativa continua independente e obrigatória onde já aplicável.
4. Validar acionador da outbox, acesso do gestor pelo link, remetente e aceite real de uma mensagem de teste. Não considerar simulação como validação externa.
5. Ativar novas execuções no marco aprovado, sem reprocessar o estoque antigo silenciosamente.
6. Monitorar notas sem configuração/responsável, tarefas paradas, falhas definitivas/incertas, leases presos e divergência entre conclusão e processamento.
7. Para reversão, suspender novas adesões conforme procedimento aprovado e manter dados/execuções existentes preservados. Não retornar a binário legado que ignore workflows ativos nem remover tabelas/versões. Versão problemática é substituída para novas notas; recuperação de notas já vinculadas segue D4.

## Entrega final esperada da implementação

- Matriz DR/AC com evidências, arquivos alterados e limites dos testes.
- Migration e plano de compatibilidade/ativação, sem alegar validação em produção quando só houver ambiente local.
- Manual curto para configurar etapas/campos, publicar nova versão, acompanhar pendências e tratar falhas de e-mail.
- Pendências externas explícitas: agendamento real, acesso ao provedor, política de legado/recuperação/retenção e autorização de publicação quando ainda não executados.
