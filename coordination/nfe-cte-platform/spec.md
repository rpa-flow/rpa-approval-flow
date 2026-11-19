# Especificação: gestão de NF-e e CT-e na plataforma

## Objetivo e limites

- Objetivo: evoluir a plataforma de gestão de notas para obter e processar NF-e e CT-e, reaproveitar o fluxo existente de aprovação e viabilizar o lançamento aprovado no Minerion, preservando o processamento atual de NFS-e.
- Escopo proposto pelo texto recebido: obtenção via FSist; identificação do tipo pelo XML; extração e armazenamento dos dados e XML; associação a fornecedores; listagem, filtros e detalhes por tipo; aprovação, recusa, histórico e auditoria; integração de lançamento no Minerion com erros e reprocessamento; validação ponta a ponta e regressão de NFS-e.
- Fora de escopo declarado: escrituração/validação fiscal completa; validação criptográfica completa; consulta direta à SEFAZ; eventos fiscais como carta de correção; relatórios novos não previstos; mudanças de processo sem relação direta com NF-e/CT-e.
- Cobertura confirmada para os novos tipos: compras e fretes contratados pelas empresas. Documentos de saída das empresas não fazem parte desta entrega; os critérios técnicos de reconhecimento dependem dos papéis e campos do XML a mapear.
- Fonte: texto fornecido pelo usuário nesta conversa e esclarecimentos subsequentes. Ainda não aprovado como especificação executável; decisões materiais seguem abertas.

## Fatos observados e decisões em aberto

| Tipo | Item | Evidência ou decisão necessária |
|---|---|---|
| Fato observado | A aplicação recebe e interpreta XML de NFS-e e mantém o campo `xmlOriginal`. | README e `src/lib/nfse-parser.ts`; não foi feita auditoria completa das rotas nesta etapa. |
| Fato observado | O enum `WorkflowDocumentType` atualmente contém apenas `NFSE`; regras de workflow e catálogo de campos também são NFS-e. | `prisma/schema.prisma`, `src/lib/workflow/` e `/api/workflows/field-catalog`. |
| Fato observado | O fluxo atual usa campos e status com nome Delphi. O usuário confirmou que Minerion é o mesmo destino e que obtenção/lançamento continuam no robô externo `rpa-web`. | Código local e resposta afirmativa do usuário à pergunta composta sobre destino/executor. O consumidor externo ainda não foi inspecionado. |
| Fato observado | O anexo indica FSist como fonte e Minerion como destino, sem descrever contratos ou mecanismo de integração. | Texto recebido. |
| Decisão confirmada | A plataforma deve permitir cadastrar um workflow separado para cada tipo (NFS-e, NF-e e CT-e), reaproveitando a capacidade de workflow existente e possibilitando configurações distintas por tipo. | Esclarecimento do usuário nesta conversa. Detalhes das regras e da ativação por tipo permanecem por fechar. |
| Decisão confirmada | NF-e/CT-e sem workflow publicado aguardam configuração, sem aprovação ou lançamento pelo fluxo legado. | Resposta do usuário na Fase 0. |
| Decisão confirmada | As exigências de aprovação serão configuráveis por tipo; não copiar automaticamente todas as exigências de NFS-e para NF-e/CT-e. | Resposta do usuário: configurar exigências por tipo. Detalhes de configuração seguem em alinhamento. |
| Decisão confirmada | Revisão administrativa por valor zero ou emissão em mês anterior vale para os três tipos. | Resposta do usuário na Fase 0. Falta definir o campo monetário de referência para NF-e/CT-e. |
| Decisão confirmada | NF-e/CT-e entram somente pela integração nesta entrega. | Upload manual de XML e cadastro sem XML para esses tipos ficam fora da entrega atual. |
| Decisão confirmada | Incluir somente compras e fretes contratados pelas empresas; relações CT-e/NF-e são informativas, com aprovação independente. | Respostas do usuário na Fase 0. |
| Decisão confirmada | Após publicar o primeiro workflow de um novo tipo, ADMIN seleciona e encaminha os documentos que aguardavam configuração e estejam elegíveis. | Reaproveitar o encaminhamento administrativo existente; não realizar encaminhamento automático desse estoque. |
| Fato confirmado | O usuário dispõe de documentação/acesso de homologação para FSist e Minerion e de exemplos anonimizados/campos obrigatórios para o Minerion. | Esclarecimento do usuário; artefatos ainda não foram compartilhados ou inspecionados neste planejamento. |
| Pendente por orientação do usuário | Qual interface a FSist oferece e seus limites, escopo de empresas/estabelecimentos e frequência. | Documentação e exemplos ficam pendentes; não presumir contrato enquanto não forem analisados. |
| Pendente por orientação do usuário | Quais campos e operações o Minerion exige, como identificar sucesso incerto e evitar duplicidade. | Documentação e exemplos ficam pendentes; destino e executor já confirmados. |
| Decisão confirmada | Somente ADMIN pode alterar dados operacionais que afetam o lançamento após aprovação, com motivo registrado. ADMIN pode reabrir nota recusada e iniciar novo ciclo com a versão publicada mais recente. | Preservar histórico, bloqueio durante envio/resultado incerto e demais pré-condições de elegibilidade. |
| Decisão confirmada | Reutilizar vínculos de fornecedor e atribuições atuais para consulta; concessão global via workflow fica restrita ao tipo configurado. | Implementar escopo consistente em listagem, detalhe, XML, exportação e relações entre documentos. |
| Decisão confirmada | Fornecedor/transportadora inexistente será criado a partir do XML, como no fluxo atual. Quando não houver identificação de uma única empresa cadastrada e ativa, o recebimento aguarda resolução do ADMIN, sem aprovação ou lançamento. | O mapeamento dos papéis do XML e os campos mínimos de autocadastro permanecem por fechar. |
| Decisão confirmada | Alteração em dados que afetam o lançamento após aprovação e antes de iniciar o envio exige nova aprovação desde o começo do workflow, usando a versão publicada mais recente do tipo. | Histórico preservado; durante envio ou resultado incerto os dados ficam bloqueados. |
| Decisão confirmada | Cancelamento conhecido impede novos envios. Quando já houve lançamento, ADMIN realiza reconciliação manual com histórico preservado, sem estorno automático. | Não implica consultar SEFAZ nem implementar cobertura completa de eventos fiscais; contrato de recebimento da informação continua pendente. |
| Decisão aberta | Quais itens de produto, tributos e informações de carga/documentos vinculados são necessários para o lançamento real, inclusive nível de detalhe por item. | Layouts e exemplos reais anonimizados, com mapeamento Minerion. |
| Decisão aberta | Qual identidade torna um documento único e como tratar XMLs repetidos, eventos, cancelamento, versões e documentos corrigidos. | Regra por chave de acesso, fonte e estabelecimento; definir atualização versus rejeição. |
| Decisão confirmada | Exibir vínculos CT-e/NF-e sem dependência entre suas aprovações. | Referência a documento ainda não importado não deve criar bloqueio de aprovação. Navegação para documento existente continua sujeita à autorização. Mapeamentos externos de lançamento permanecem pendentes. |
| Decisão aberta | Estratégia de implantação, migração dos registros antigos sem `documentType`, ativação gradual e recuperação/rollback. | Confirmar rollout e compatibilidade operacional. |

## Domínio

- Atores: operadores de integração/ADMIN, gestores aprovadores e processo automatizado de lançamento.
- Tipos: NFS-e, NF-e e CT-e. NF-e e CT-e devem compartilhar a gestão geral sem presumir que seus dados fiscais específicos sejam intercambiáveis.
- Ciclo proposto: obtenção → identificação e parsing → registro/associação → workflow configurado para o tipo → aprovação/recusa → lançamento no Minerion → conclusão ou falha recuperável. Transições, estados e atores autorizados ainda precisam ser fechados.

### Regras de domínio propostas

- DR-1: cada XML reconhecido deve ser classificado como NFS-e, NF-e ou CT-e antes de seguir o fluxo; XML não reconhecido ou inválido deve gerar falha rastreável sem criar lançamento.
- DR-2: cada documento deve preservar o XML original e os dados extraídos necessários à gestão e ao lançamento; campos específicos de NF-e e CT-e não devem ser inferidos de outros tipos.
- DR-3: a identidade acordada e uma restrição persistente devem impedir criação duplicada inclusive sob concorrência. Prevenir duplicidade de lançamento exige também contrato de idempotência ou reconciliação no destino; um timeout não comprova falha nem autoriza reenvio automático.
- DR-4: somente documentos elegíveis e aprovados podem ser enviados ao Minerion; falhas devem permanecer identificáveis e permitir reprocessamento idempotente conforme contrato do Minerion.
- DR-5: indisponibilidade da FSist, erro de parsing, associação ambígua e falha/resultado incerto do Minerion devem ser registrados com contexto suficiente para suporte e recuperação, sem expor segredos.
- DR-6: mudanças devem preservar o fluxo atual de NFS-e, inclusive integrações existentes; eventual migração do valor nulo de `documentType` precisa ter regra explícita.
- DR-7: a configuração de workflow deve ser identificada pelo tipo do documento; ADMIN pode manter configurações distintas para NFS-e, NF-e e CT-e, e a execução de cada documento usa a configuração publicada correspondente ao seu tipo.
- DR-8 (confirmada): NF-e e CT-e sem workflow publicado devem permanecer aguardando configuração. Não podem ser aprovados pelo fluxo legado nem disponibilizados para lançamento. Depois da publicação, ADMIN seleciona e encaminha os documentos elegíveis que aguardavam configuração; publicar não encaminha esse estoque nem aprova notas automaticamente. Revisão/associação pendentes impedem o encaminhamento.
- DR-9 (confirmada): exigências de aprovação devem ser configuráveis por tipo, respeitando o catálogo aplicável. Regras obrigatórias atuais de NFS-e não são automaticamente impostas a NF-e/CT-e; preservar versões NFS-e existentes.
- DR-10 (confirmada): NFS-e, NF-e e CT-e são submetidos à revisão administrativa por valor zero ou emissão anterior ao mês corrente, usando o fuso operacional atual (São Paulo). O valor fiscal de referência de NF-e/CT-e depende do mapeamento pendente, sem usar valor de serviço inexistente como zero.
- DR-11 (confirmada): a entrada de NF-e/CT-e será exclusivamente pela integração nesta entrega; não habilitar upload manual nem cadastro sem XML para os novos tipos.
- DR-12 (confirmada): o escopo de NF-e/CT-e contempla somente compras e fretes contratados pelas empresas. Não classificar todo XML disponibilizado pela fonte como elegível; critérios de papéis/empresa e situações cobertas devem estar definidos antes de ativar a ingestão operacional.
- DR-13 (confirmada): as referências CT-e/NF-e são informativas. A ausência de NF-e na plataforma ou seu estado de aprovação não impede a aprovação do CT-e. Cada documento segue seu próprio workflow. Referenciar uma chave não concede acesso ao documento relacionado.
- DR-14 (confirmada): fornecedor/transportadora ainda não cadastrado deve ser criado com os dados do XML conforme o padrão existente, sem gerar cadastros duplicados em reenvios/concorrência. Campos mínimos e comportamento de XML insuficiente seguem pendentes; não fabricar identificadores nem código externo para completar o cadastro.
- DR-15 (confirmada): se não for possível associar o documento a uma única empresa cadastrada e ativa, guardar o recebimento e aguardar resolução do ADMIN, sem aprovação nem lançamento. O vínculo resolvido deve ser rastreável; critérios de identificação e compatibilidade com os papéis do XML ainda precisam ser mapeados.
- DR-16 (confirmada): uma alteração que afete o lançamento, após a aprovação e antes do início do envio ao Minerion, invalida a autorização de envio dos dados anteriores e exige novo ciclo de aprovação desde a primeira etapa. O novo ciclo usa a versão publicada mais recente do tipo no momento de sua criação; essa versão fica vinculada ao ciclo. Preservar XML original, dados anteriores, autoria/motivo da mudança e histórico de aprovações. O escopo dos campos materiais segue em definição. Sem versão publicada, aguardar configuração sem liberar envio nem reutilizar a aprovação anterior.
- DR-17 (confirmada): durante tentativa de envio ao Minerion ou enquanto seu resultado estiver incerto, bloquear alterações nos dados que afetam o lançamento até confirmação ou resolução da incerteza. Timeout ou expiração da reserva não comprovam resolução. A proteção deve valer para telas, APIs e novas tentativas, mantendo rastreável o payload enviado.
- DR-18 (confirmada): cancelamento conhecido impede novos envios. Se o documento já estiver lançado, encaminhar ao ADMIN para reconciliação manual, preservando histórico e referência do lançamento, sem estorno automático. Cancelamento conhecido não pode ser convertido em simples erro para retentativa. Se a informação chegar durante envio/resultado incerto, registrar o cancelamento e reconciliar o efeito externo, sem pressupor que a operação já iniciada pôde ser interrompida.
- DR-19 (confirmada): somente ADMIN pode alterar dados operacionais que afetam o lançamento após a aprovação, com motivo registrado. A alteração segue DR-16 e não pode contornar o bloqueio de DR-17. XML original não é editado; ajustes operacionais são registrados separadamente.
- DR-20 (confirmada): ADMIN pode reabrir uma nota recusada, corrigi-la e iniciar novo ciclo desde a primeira etapa com a versão publicada mais recente do tipo. Preservar recusa, decisões e dados anteriores; não reativar comandos/tarefas do ciclo encerrado. Reabertura não aprova nem libera envio e não remove impedimentos de cancelamento, revisão administrativa ou associação. Sem versão publicada, aguardar configuração.
- DR-21 (confirmada): a consulta reaproveita os vínculos de fornecedor e as atribuições existentes. A consulta global concedida pelo workflow vale somente para o tipo configurado e não amplia implicitamente o acesso aos demais tipos. Aplicar a mesma autorização a listagem, detalhe, XML, exportações e navegação de relações; a ausência de outra concessão de acesso impede consulta fora do tipo autorizado.

## Cenários de aceite preliminares

### AC-1: importar NF-e válida

**Dado** um XML de NF-e obtido da FSist e uma empresa/fornecedor que possa ser resolvido sem ambiguidade

**Quando** o documento for recebido pela plataforma

**Então** o sistema identifica NF-e, armazena XML e campos acordados, registra a origem e o associa ao fluxo de gestão correspondente sem duplicar a chave já registrada.

### AC-2: importar CT-e com documentos relacionados

**Dado** um XML de CT-e válido com referências a NF-e

**Quando** o documento for processado

**Então** o sistema armazena os campos acordados do CT-e e exibe suas referências de forma informativa. A aprovação do CT-e é independente da existência ou aprovação das NF-e relacionadas; acesso ao detalhe de uma NF-e existente exige autorização própria.

### AC-3: XML inválido ou associação não resolvida

**Dado** um XML inválido/não reconhecido, sem dados suficientes para resolver/cadastrar fornecedor, ou sem identificação de uma única empresa cadastrada e ativa

**Quando** a rotina tentar processá-lo

**Então** a falha fica registrada para consulta e ação autorizada, sem criar documento pronto para aprovação ou lançamento.

**E** fornecedor inexistente, quando o XML tiver dados suficientes, é criado automaticamente; a ausência de cadastro por si só não é tratada como associação impossível.

### AC-4: aprovação e lançamento

**Dado** NF-e ou CT-e elegível, aprovado e ainda não lançado

**Quando** a integração enviar o documento ao Minerion

**Então** o resultado atualiza o status da plataforma; sucesso não pode gerar lançamento duplicado e falha pode ser identificada e reprocessada segundo as regras acordadas.

### AC-5: regressão NFS-e

**Dado** uma NFS-e submetida aos fluxos existentes

**Quando** as mudanças de NF-e/CT-e estiverem ativadas

**Então** ingestão, aprovação, processamento e integração atuais de NFS-e continuam funcionando conforme seus contratos vigentes.

### AC-6: configurações distintas por tipo

**Dado** um ADMIN autorizado a configurar workflows

**Quando** cadastrar ou publicar configurações para NFS-e, NF-e e CT-e

**Então** cada tipo pode ter uma configuração própria, e cada documento segue apenas a configuração publicada do seu tipo, preservando versões em andamento conforme as regras de versionamento existentes.

### AC-23: novos tipos sem configuração publicada

**Dado** NF-e ou CT-e recebido sem workflow publicado para seu tipo

**Quando** o documento for incorporado à gestão

**Então** fica aguardando configuração, sem aprovação legada ou envio ao Minerion. Após publicar, ADMIN seleciona e encaminha as notas elegíveis; publicar não encaminha automaticamente o estoque nem aprova notas. Pendências de revisão/associação continuam bloqueando a entrada no workflow.

### AC-24: revisão administrativa nos três tipos

**Dado** documento de um dos três tipos com valor fiscal de referência zero ou emissão em mês anterior no fuso de São Paulo

**Quando** for avaliado na ingestão

**Então** fica retido para revisão administrativa antes da aprovação e do lançamento, respeitando a decisão persistida de liberação ou de ignorar. Campo ausente não deve ser convertido em zero; o tratamento de valor ausente precisa ser fechado no mapeamento.

### AC-25: exigências próprias e entrada pela integração

**Dado** configurações com exigências distintas para NF-e e CT-e

**Quando** documentos desses tipos forem recebidos pela integração e passarem pelas etapas

**Então** cada execução exige os campos previstos para seu tipo/versão, sem importar requisitos incompatíveis de NFS-e; não há habilitação de cadastro manual dos novos tipos.

### AC-26: cobertura e relações independentes

**Dado** um lote com compras/fretes contratados pelas empresas e documentos de saída não cobertos

**Quando** a integração classificar os documentos segundo os critérios de associação acordados

**Então** somente os documentos cobertos entram no fluxo operacional; a destinação rastreável dos demais deve ser definida no contrato de ingestão. CT-e elegível pode ser aprovado sem aguardar importação/aprovação das NF-e referenciadas.

### AC-27: autocadastro e empresa pendente

**Dado** NF-e/CT-e recebido com fornecedor/transportadora inexistente e dados suficientes para cadastrá-lo

**Quando** a plataforma processar o XML

**Então** cria ou reutiliza um único fornecedor segundo sua identidade, inclusive em reenvios concorrentes. Se não identificar uma única empresa cadastrada e ativa, preserva o recebimento para resolução do ADMIN e impede aprovação/lançamento.

### AC-28: mudança material após aprovação

**Dado** um documento aprovado cujo envio ao Minerion ainda não começou

**Quando** uma alteração em dados que afetem o lançamento for autorizada e persistida

**Então** o documento perde a elegibilidade de envio e exige nova aprovação desde a primeira etapa, com a versão publicada mais recente do tipo ao criar o novo ciclo, preservando os dados e as decisões anteriores. O envio e a alteração concorrentes precisam ser serializados para que dados modificados não sejam enviados com aprovação antiga. Publicações posteriores não alteram a versão já vinculada ao novo ciclo.

### AC-29: bloqueio durante envio e resultado incerto

**Dado** um documento com tentativa de envio em andamento ou resultado externo incerto

**Quando** usuário ou integração tentar modificar os dados de lançamento ou liberar outra tentativa sem resolver o resultado

**Então** a alteração/liberação é impedida; o payload da tentativa e a pendência de reconciliação permanecem rastreáveis. Expiração de reserva ou timeout não desbloqueia os dados automaticamente.

### AC-30: cancelamento conhecido por estágio

**Dado** um documento cujo cancelamento foi informado à plataforma

**Quando** o cancelamento for registrado

**Então** não são permitidos novos envios. Se já houve lançamento, ADMIN recebe pendência de reconciliação manual sem estorno automático. Se havia envio em andamento/resultado incerto, a plataforma preserva a informação de cancelamento e apura o resultado externo, sem assumir que o lançamento não ocorreu.

### AC-31: alteração pós-aprovação restrita ao ADMIN

**Dado** um documento aprovado e ainda não enviado

**Quando** um usuário tentar alterar dados operacionais que afetam seu lançamento

**Então** somente ADMIN com motivo registrado consegue persistir a mudança, provocando o novo ciclo previsto em DR-16. Gestor ou integração não obtém essa permissão por atribuição, vínculo de fornecedor ou acesso global. Durante envio/resultado incerto, a alteração também é impedida para ADMIN.

### AC-32: reabertura administrativa de nota recusada

**Dado** uma nota recusada e uma versão publicada para seu tipo

**Quando** ADMIN reabrir e encaminhar a nota corrigida e elegível

**Então** um novo ciclo começa na primeira etapa usando a versão publicada mais recente naquele momento, preservando histórico de recusa e ciclos anteriores. Gestor não pode reabrir por conta própria; comandos antigos não avançam o novo ciclo; cancelar/reter a nota continua impedindo seu lançamento.

### AC-33: consulta global restrita ao tipo

**Dado** gestor com consulta global concedida apenas pelo workflow NFS-e, sem outra concessão para uma NF-e/CT-e

**Quando** tentar consultar essa NF-e/CT-e por listagem, detalhe, XML, exportação ou vínculo relacionado

**Então** a concessão global NFS-e não dá acesso. Vínculos de fornecedor e atribuições válidas continuam concedendo os acessos próprios, conforme as regras reaproveitadas.

## Erros, autorização e casos de borda

A análise detalhada, com prioridades, evidências locais e cenários adicionais propostos, está em [review.md](review.md). As recomendações da revisão não são decisões de negócio aprovadas.

- Definir autorização para consulta de XML, ações administrativas de reprocessamento e envio manual ao Minerion.
- Definir limites de tamanho/tempo dos XMLs, namespaces/layouts aceitos, chaves ausentes e versões desconhecidas.
- Definir idempotência sob concorrência e resposta para timeout com resultado incerto no Minerion.
- Não enviar XML ou credenciais a telas/logs sem necessidade; limitar dados expostos por API ao papel autorizado.
- Tratar migração de notas legadas com `documentType = null` sem classificar documentos de forma incorreta.

## Decisões técnicas ainda não tomadas

| Decisão | Estado | Consequência a avaliar |
|---|---|---|
| Persistência dos campos específicos de NF-e/CT-e | Aberta; comparar extensão do modelo atual com dados tipados por documento. | Migration, consultas e consistência dos dados. |
| Interface de obtenção FSist e execução agendada | Executor externo `rpa-web` confirmado; mecanismo e agenda pendentes dos contratos. | Segredos, observabilidade, retentativas e limites entre robô e plataforma. |
| Integração Minerion | Aberta, depende do contrato e da possibilidade de homologação. | Idempotência, timeout, reconciliação e segurança. |
| Aprovação por tipo | Confirmado que deve haver workflow separado por tipo; detalhes de campos e etapas continuam em aberto. O schema atual tem enum e configuração limitados a NFSE. | Expandir catálogo de campos, configuração, autorização, versionamento e migração sem misturar dados específicos dos tipos. |
| Guarda do XML | Em aberto confirmar retenção, volume, acesso e eventual armazenamento externo. | Custo, privacidade e respostas das APIs existentes. |

## Plano de implementação proposto

A descoberta e os contratos em alinhamento da Fase 0 estão em [f0-contracts.md](f0-contracts.md). A fase está em andamento e depende dos materiais externos e das decisões ali identificadas.

1. **Fase 0 — Descoberta técnica e contratos:** inspecionar rotas/modelo atuais e os contratos, exemplos anonimizados e acesso de homologação já disponíveis para FSist e Minerion; confirmar permissões, campos obrigatórios, volume, frequência e ambiente de homologação.
2. **Fase 1 — Domínio, schema e parsing:** fechar identidade e lifecycle; modelar os tipos e campos necessários; implementar detecção/parsers versionados, preservação do XML, validações e idempotência de ingestão.
3. **Fase 2 — Aquisição FSist:** implementar busca/download, controle de checkpoints ou paginação conforme contrato, retentativas, registro de falhas e operação observável.
4. **Fase 3 — Gestão e aprovação:** ampliar APIs/listagens/detalhes e filtros; associar fornecedor/empresa; estender workflow a NF-e/CT-e apenas conforme regras confirmadas; preservar controles de acesso.
5. **Fase 4 — Lançamento Minerion:** mapear campos, enviar somente documentos aprovados, reconciliar resultados incertos, registrar falhas e permitir reprocessamento autorizado e idempotente.
6. **Fase 5 — Validação e ativação:** testes focados de parsing/idempotência/autorização, integração em homologação, regressão NFS-e, observabilidade e rollout gradual com plano de recuperação.

### Entregáveis necessários para fechar a Fase 0

- Matriz por tipo: entrada suportada, identidade, empresa/papel no documento, fornecedor, valor de aprovação, campos/precisão, workflow e destino do lançamento.
- Contratos de ingestão, consulta e processamento: autenticação/escopo, payloads por tipo, erros, idempotência, concorrência, paginação e compatibilidade com consumidores antigos.
- Matriz de transições: situação fiscal, ingestão, revisão administrativa, aprovação e lançamento; especificar quais combinações bloqueiam cada ação.
- Modelagem de ciclos de reaprovação: o schema atual admite um `InvoiceWorkflow` por nota (`invoiceId` único). Definir extensão para múltiplos ciclos ou histórico equivalente sem apagar tarefas, decisões e comandos idempotentes anteriores; não confundir uma nova tentativa técnica de envio com novo ciclo de aprovação.
- Decisões sobre ausência de workflow publicado, responsável inativo, alteração após aprovação, documentos históricos e resultado incerto no Minerion.
- Matriz de falhas e recuperação por etapa, incluindo checkpoint da coleta e evidências de reconciliação do lançamento.
- Plano de migração e ativação por tipo/empresa, com critérios observáveis de entrada/saída e responsáveis operacionais.

## Riscos, rollout e itens adiados

- Os contratos FSist e Minerion são dependências críticas; sem eles não é possível fechar comportamento de obtenção, sucesso, duplicidade ou recuperação.
- O usuário informou que os contratos, homologação e exemplos necessários estão disponíveis e pediu para deixar sua disponibilização/análise pendente. Eles seguem como dependência das integrações; isso não impede alinhar regras da plataforma.
- O texto cita implantação no ambiente atual, mas ainda não autoriza uma ativação específica nem define janela, rollout ou responsáveis.
- A proposta não cobre escrituração fiscal completa, validação junto à SEFAZ nem eventos fiscais além do que for necessário para reconhecer o documento e lançá-lo.
- Esta especificação é rascunho de planejamento; nenhum código de produto foi alterado e as regras/cenários acima ainda precisam de alinhamento.
