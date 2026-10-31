# Especificação: workflow de aprovação por tipo, inicialmente NFS-e

Data: 31/10/2026. Estado: proposta para revisão; sem autorização de implementação nesta solicitação.

## Objetivo e limites

Permitir que ADMIN configure, pela interface, uma sequência de aprovação para cada tipo de documento. Nesta entrega, somente NFS-e terá entrada, catálogo de campos e execução disponíveis. A estrutura relacionará documento e configuração a um tipo explícito, permitindo adicionar outros tipos depois.

### Escopo confirmado na conversa

- Um fluxo configurável por tipo; somente NFS-e operacional agora.
- Etapas ordenadas, cada uma com um gestor fixo selecionado pela tela.
- Visibilidade, edição e obrigatoriedade dos campos existentes configuráveis por etapa.
- Ocultação somente visual; APIs e exportações continuam retornando dados conforme a autorização de consulta.
- E-mail na primeira atribuição e a cada alteração de responsável.
- Auditoria de configurações, decisões, atribuições e alterações de dados.
- Configuração versionada, preservando a versão das notas em andamento.
- Aprovação final somente depois de concluir todas as etapas.

### Fora de escopo

- Entrada, parser, campos e execução de CT-e e nota de produto.
- Criação de campos personalizados, scripts de regras ou editor de processos genérico.
- Seleção automática de gestor por fornecedor, valor, risco ou classificação adicional.
- Etapas paralelas, quórum, delegação automática e escalonamento por prazo.
- Novo desenho de recusa, devolução, reabertura e cancelamento. A compatibilidade das ações existentes precisa ser decidida antes da ativação.
- Implantação ou alteração do código da aplicação nesta solicitação de planejamento.

## Fatos observados

Inspeção estática do checkout em `7705e32`; esta referência não comprova o estado de produção.

| Fato | Fonte |
|---|---|
| `Invoice` não tem etapa, execução ou responsável atual de workflow; `responsavelValidacao` registra a validação, não uma tarefa pendente. | `prisma/schema.prisma` |
| O acesso de gestores usa vínculos `ManagerSupplier`; atribuir um gestor arbitrário não concede acesso à nota hoje. | `src/lib/auth.ts`, `src/lib/invoice-query.ts`, `src/app/api/notas/[id]/route.ts` |
| Aprovação atual exige avaliação do serviço, OC ou contrato e data de pagamento; `APROVADO` também marca `PROCESSANDO`. | `src/app/api/notas/[id]/route.ts`, `src/lib/payment-date.ts` |
| Há outros caminhos de alteração de status, inclusive comunicação administrativa e atualização de integração. | `src/app/api/notas/[id]/comunicacao/route.ts`, `src/app/api/notas/[id]/route.ts` |
| Existe revisão administrativa prévia, com controle de concorrência próprio e liberação para os gestores do fornecedor. | `src/app/api/notas/[id]/revisao/route.ts`, `src/lib/invoice-admin-review*.ts` |
| Parte da auditoria é gravada fora da transação da nota; `NoteAuditLog` depende de uma nota e tem exclusão em cascata. | `src/lib/audit.ts`, `prisma/schema.prisma`, rotas de notas |
| `ServiceEvaluation` armazena uma avaliação corrente por nota. | `prisma/schema.prisma` |
| Microsoft Graph já é usado; falta de configuração resulta em simulação, e alguns helpers não retornam esse resultado ao chamador. | `src/lib/email.ts` |
| Lembretes atuais usam gestores e e-mails extras do fornecedor. | `src/app/api/notas/lembretes/route.ts` |
| O parser atual identifica família NFS-e e layouts Nacional/ABRASF, sem classificação de workflow na nota. | `src/lib/nfse-parser.ts`, `prisma/schema.prisma` |
| Existem arquivos de testes focados, mas não há script `test` no `package.json`. | `src/lib/*.test.ts`, `package.json` |

## Decisões pendentes e propostas

As propostas abaixo não são decisões já confirmadas pelo usuário. Devem ser resolvidas na F0 antes de implementar a regra dependente.

| ID | Decisão | Recomendação para a primeira entrega |
|---|---|---|
| D1 | Gestor fixo pode atuar sem vínculo com o fornecedor? Pode continuar consultando depois de sua etapa? | Atribuição concede acesso somente àquela nota; manter consulta aos participantes que já atuaram e aprovação apenas ao responsável atual. Não criar vínculo com todas as notas do fornecedor. Preservar os demais acessos existentes. |
| D2 | Quais exigências atuais continuam obrigatórias na aprovação final? | Preservar avaliação, OC ou contrato e data válida; permitir distribuir seu preenchimento entre etapas. Publicação valida que há caminho editável para cada requisito. Campos fiscais originais e de processamento não se tornam editáveis só por configuração. |
| D3 | Como ativar sem mudar notas antigas e sem perder novas entradas? | Ativação explícita por tipo e data de corte, após publicar a primeira versão. Notas anteriores mantêm o fluxo legado; novas notas entram no workflow. Não criar aprovações históricas fictícias. Após ativação, ausência de configuração deixa novas notas bloqueadas para configuração administrativa. |
| D4 | Como tratar recusa/reabertura/erro de processamento existentes e gestor inativo em execução? | Manter o legado para notas sem execução. Para notas com workflow, definir na F0 uma política mínima de compatibilidade e recuperação; não permitir que rotas antigas alterem status deixando execução divergente. Não desenvolver novo fluxo de devolução. |
| D5 | Como acionar a fila de e-mails e por quanto tempo preservar eventos? | Consumidor autenticado acionado por agendamento compatível com o ambiente; sem processo residente. Impedir exclusão destrutiva de notas/versões com histórico novo. Fechar retenção e acesso operacional antes de ativar. |
| D6 | Etapas consecutivas com o mesmo gestor geram novo aviso? | Tratar cada entrada em etapa como nova tarefa, sem pular aprovação, e notificar mesmo quando o gestor se repete. Esta extensão deve ser validada. |

## Domínio e ciclo de vida propostos

- **Tipo de documento:** chave estável, inicialmente `NFSE`; não confundir com layout do XML.
- **Definição do fluxo:** configuração associada a um tipo e ponteiro para sua versão vigente.
- **Versão:** rascunho editável; ao publicar, conteúdo imutável. A versão substituída continua disponível às suas execuções.
- **Etapa:** identidade estável na versão, nome, posição, gestor e política dos campos.
- **Execução:** percurso de uma nota, vinculado a uma versão; tem situação própria e controle de concorrência.
- **Tarefa da etapa:** entrada efetiva em uma etapa, com responsável, instante de atribuição e decisão. Referencia a configuração e preserva snapshots de identificação.
- **Evento:** registro imutável de uma ação, com ator, origem, correlação e diferenças dos dados.
- **Notificação pendente (outbox):** intenção de envio criada junto com a atribuição e processada depois do commit.

Percurso proposto: entrada → revisão administrativa quando exigida → espera por configuração quando necessário → etapa 1 → demais etapas → conclusão do workflow → processamento existente.

O bloqueio administrativo é uma condição prévia, não uma etapa livremente removível pelo editor. O momento de vincular a versão será a primeira atribuição operacional, após a liberação administrativa; registrar essa escolha na F0 junto de D3. Durante as etapas, a nota permanece `AGUARDANDO_APROVACAO` e o processamento permanece `PENDENTE`.

## Regras de domínio

### Confirmadas

- **DR-1:** configurar e executar por tipo explícito; a primeira entrega aceita apenas `NFSE`. Tipos futuros não aparecem como opções operacionais nem são aceitos por payload arbitrário.
- **DR-2:** somente ADMIN cria, ordena, configura e publica versões. Cada etapa tem um gestor fixo; a execução segue a ordem publicada.
- **DR-3:** uma nota em execução usa uma única versão. Nova publicação não altera etapas, gestor configurado ou política de campos de execuções já iniciadas.
- **DR-4:** a política de campo controla sua apresentação na etapa e sua possibilidade de edição/preenchimento. Ocultação não constitui sigilo nem retira valores das APIs/exportações.
- **DR-5:** concluir uma etapa intermediária atribui a próxima; concluir a última aprova a nota e libera o processamento existente. Nenhuma etapa pode ser ignorada por uma alteração direta de status.
- **DR-6:** cada primeira atribuição ou mudança de responsável gera intenção persistente de e-mail ao responsável efetivo. Falha de envio fica registrada e permite nova tentativa, sem desfazer a decisão.
- **DR-7:** decisões, mudanças de dados/responsável, publicação e alteração de configuração ficam auditáveis, com autor/origem e horário. Etapa concluída permanece reconstruível mesmo se nomes/cadastros mudarem.

### Regras técnicas propostas

- **DR-8:** publicação valida nome/ordem das etapas, presença de responsável ativo elegível, catálogo de campos e requisitos finais; campo obrigatório deve ser visível e editável na etapa. Rejeitar campos desconhecidos, combinações impossíveis e edição de campos imutáveis.
- **DR-9:** separar consulta de execução. Somente o responsável atual pode editar os campos autorizados e concluir a etapa; ADMIN não pula etapas implicitamente. A ampliação de consulta por atribuição depende de D1.
- **DR-10:** toda escrita valida os campos no servidor. Leitura continua disponível pelas permissões usuais; ocultar visualmente não autoriza editar dados por chamada direta. Reutilizar validações dos valores e validar obrigatoriedade na conclusão, sem exigir campos ainda destinados a etapas futuras.
- **DR-11:** alteração de campos, decisão, avanço, nova atribuição, auditoria e outbox são atômicos. Uma falha reverte a transição completa. Configuração também é salva com sua auditoria na mesma transação.
- **DR-12:** ação exige revisão esperada e chave idempotente. Repetição idêntica devolve o resultado original; reutilização da chave com outro conteúdo é rejeitada. Ação obsoleta ou concorrente gera conflito sem segundo avanço ou nova intenção de envio.
- **DR-13:** revisão administrativa pendente impede atribuição operacional, aprovação e lembretes do workflow. Sua liberação inicia uma única execução e notifica o gestor da primeira etapa, conforme D3.
- **DR-14:** a conclusão revalida as exigências finais acordadas em D2 com os dados acumulados. Política publicada deve permitir corrigir campos sujeitos ao tempo na etapa final, em especial data de pagamento, sem exigir devolução.
- **DR-15:** e-mails distinguem pendente, em processamento, aceito pelo provedor, falha, resultado incerto e simulado. Cada tentativa é preservada. Simulação não é envio real; aceite pelo provedor não prova entrega na caixa postal.
- **DR-16:** lembretes e reenvios manuais de notas com execução resolvem a tarefa atual, sem disparar ao conjunto antigo de gestores do fornecedor. Cadência e cópias adicionais exigem compatibilidade explícita, sem modificar regras do legado.
- **DR-17:** falhas de configuração/responsável são visíveis na fila administrativa. A solução não escolhe outro gestor silenciosamente nem libera processamento. Recuperação depende de D4.
- **DR-18:** versões usadas, tarefas, eventos e tentativas não são editados/apagados como efeito de uma alteração comum de cadastro. A retenção e as restrições de exclusão dependem de D5.

## Cenários de aceite

### AC-1: configuração válida e publicação

**Given** ADMIN e uma definição NFS-e com rascunho válido

**When** configura duas etapas, gestores e campos e publica

**Then** existe uma versão vigente e imutável, com auditoria da publicação; edições posteriores usam novo rascunho.

### AC-2: configuração inconsistente

**Given** rascunho sem etapa, com responsável inativo, campo desconhecido, obrigatório oculto ou requisito final sem caminho de preenchimento

**When** ADMIN tenta publicar

**Then** a API rejeita e identifica o problema; a versão vigente não muda.

### AC-3: primeira atribuição

**Given** nova NFS-e abrangida pela ativação, versão vigente e nenhuma revisão pendente

**When** a nota é criada e seu fluxo iniciado

**Then** há uma única execução, primeira tarefa, auditoria e notificação pendente para o gestor correto; ingestão repetida não duplica esses registros.

### AC-4: revisão administrativa prévia

**Given** nota retida para revisão administrativa

**When** é recebida e depois liberada por ADMIN

**Then** não há atribuição operacional antes da liberação; após liberar, inicia-se uma única execução na versão aplicável e notifica-se o primeiro gestor.

### AC-5: aprovação intermediária

**Given** nota na primeira de duas etapas e usuário responsável

**When** preenche os campos exigidos e conclui

**Then** a primeira tarefa termina, a segunda é atribuída e seu e-mail é enfileirado; a nota permanece aguardando aprovação, com processamento pendente.

### AC-6: aprovação final

**Given** todas as etapas anteriores concluídas e requisitos finais satisfeitos

**When** o último responsável conclui

**Then** a execução termina, a nota torna-se `APROVADO`, os dados de validação final são registrados e o processamento existente é liberado uma única vez.

### AC-7: autorização e caminhos antigos

**Given** nota com execução incompleta

**When** outro gestor tenta concluir, ou uma rota antiga/API de integração tenta aprovar ou iniciar/concluir processamento diretamente

**Then** a ação é rejeitada sem alterar a etapa, ainda que o usuário tenha permissão de consulta; atualizações técnicas permitidas após aprovação final continuam compatíveis.

### AC-8: campos e obrigatoriedade

**Given** campo oculto na etapa 1 e editável/obrigatório na etapa 2

**When** os gestores abrem o formulário e concluem suas etapas

**Then** a etapa 1 não mostra nem exige esse campo; a etapa 2 o mostra e exige. APIs/exportações de consulta continuam retornando o valor quando autorizado; escritas fora da política são rejeitadas.

### AC-9: requisito dependente do tempo

**Given** data de pagamento válida quando informada em etapa anterior, mas inválida na conclusão final

**When** o último gestor tenta concluir

**Then** a aprovação é bloqueada com mensagem por campo e o formulário final permite corrigir a data, sem necessidade de uma devolução não implementada.

### AC-10: concorrência e idempotência

**Given** duas requisições para a mesma tarefa/revisão

**When** chegam simultaneamente ou o cliente repete após timeout

**Then** somente uma transição e uma intenção de envio são criadas; repetição idêntica é reconhecida e revisão obsoleta recebe conflito.

### AC-11: consistência da auditoria

**Given** uma transição válida

**When** a gravação da auditoria ou da outbox falha

**Then** a decisão e todas as mudanças daquela transação são revertidas; nenhum avanço sem registro é confirmado.

### AC-12: falhas e simulação de e-mail

**Given** atribuição confirmada e notificação pendente

**When** o provedor falha, o processo é interrompido ou a configuração permite apenas simulação

**Then** a nota preserva seu estado, a tentativa tem resultado verificável e a fila oferece a recuperação aplicável; não registra simulação como sucesso real nem promete entrega exatamente uma vez.

### AC-13: preservação de versão

**Given** nota A na versão 1 e publicação da versão 2 para NFS-e

**When** A avança e uma nota B elegível inicia seu fluxo

**Then** A usa a versão 1 e B usa a versão 2; duas publicações concorrentes não criam dois ponteiros vigentes.

### AC-14: configuração ausente, legado e bloqueios

**Given** política de ativação/legado aprovada em D3 e compatibilidade definida em D4

**When** entram notas antes/depois do corte, falta configuração ou um gestor se torna inativo

**Then** cada situação segue a política documentada, sem migração automática de notas antigas, perda da nota ou aprovação indevida; os bloqueios são visíveis ao ADMIN.

### AC-15: auditoria de configuração e histórico

**Given** mudança de rascunho, publicação, alteração de campos ou decisão de uma tarefa

**When** ADMIN ou usuário autorizado consulta o histórico correspondente

**Then** identifica autor, horário, tipo/versão/etapa, responsáveis e diferenças; alterar um nome no cadastro não apaga a identidade registrada no evento.

### AC-16: consulta por atribuição e lembretes

**Given** gestor escolhido sem vínculo com o fornecedor e política D1 aprovada

**When** consulta sua tarefa, conclui e o sistema envia o lembrete seguinte

**Then** o acesso segue exatamente D1, sem abrir outras notas do fornecedor; o lembrete vai ao responsável atual conforme DR-16.

## Limites de erro e operação

- `400`: contrato inválido ou tipo/campo desconhecido; `401`: sem autenticação; `403`: ação não autorizada; `404`: recurso inexistente ou fora do escopo, conforme padrão existente.
- `409`: revisão desatualizada, etapa já encerrada, estado incompatível ou publicação concorrente. Erros de configuração/regra usam código estável e detalhes por campo.
- Falha de envio não transforma uma conclusão já confirmada em erro de aprovação. O retorno diferencia estado da tarefa e estado da notificação.
- Não registrar credenciais ou respostas externas completas nos eventos; registrar dados necessários à reconstrução e erros saneados.
- Tipo explícito no banco não implica confiar em um tipo informado pelo cliente: criação valida contra o parser e o contrato manual NFS-e vigente.

## Rastreabilidade e entrega

O [plano de implementação](plan.md) detalha contratos propostos, modelo de persistência, fases, verificações, ativação e reversão. A implementação deverá mapear suas evidências aos IDs DR/AC deste documento. D1–D6 permanecem recomendações até alinhamento explícito.
