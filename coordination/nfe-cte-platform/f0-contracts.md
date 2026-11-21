# Fase 0 — descoberta e definição dos contratos

Estado: Fase 0 de planejamento concluída; consultar [f0-consolidado.md](f0-consolidado.md) para a versão vigente e verificações restantes. Minerion/Delphi e coleta direta FSist estão fora deste plano. Este documento não comprova implementação nem comportamento em produção.

> Consolidação vigente: a arquitetura acordada é uma tabela central com dados comuns e uma tabela de detalhes para cada tipo; preservar versões e histórico e relacionar CT-e substituto ao original. Workflow é configurado por tipo. A API distingue reenvio equivalente de conflito de conteúdo. Campos de interface foram aprovados. Trechos abaixo que tratam esses pontos como pendentes estão superados; referências a lançamento externo são histórico fora do escopo.

Pendências técnicas de Fase 0: mapear os campos comuns e específicos, desenhar migração compatível com NFS-e e dados existentes, detalhar identidade e comparação de XML, respostas da API, situação fiscal e bloqueios, e resolver associação de empresa e chegada de substituição fora de ordem. Esses pontos não exigem definir o consumidor externo.

As respostas recentes fecham decisões de ingestão e associação. Contrato externo do consumidor não será desenhado aqui: entrada, autenticação e resposta devem seguir a API NFS-e existente. Decisões antigas sobre envio, timeout, reconciliação e campos obrigatórios do Minerion estão adiadas; não são critérios de aceite deste plano.

## Decisões confirmadas

- Receber NFS-e, NF-e e CT-e por uma interface API e exibi-los no portal de aprovação.
- A API existente de NFS-e é o padrão de formato, autenticação e resposta para os três tipos. O consumidor é separado e está fora do plano.
- Cada tipo (NFS-e, NF-e e CT-e) terá sua própria configuração de workflow.
- Exemplos de NF-e e CT-e foram inspecionados; a NFS-e segue o formato já recebido pela plataforma.
- Minerion/Delphi, `rpa-web` e lançamento após aprovação ficam explicitamente fora do escopo deste plano.
- NF-e/CT-e sem workflow publicado aguardam configuração, sem aprovação legada ou lançamento.
- Após recepção e validações, notas novas entram automaticamente no workflow já publicado para o tipo; sem workflow publicado, aguardam seleção do ADMIN depois da primeira publicação.
- XML corrigido de documento existente cria versão histórica, sinaliza a mudança e suspende o avanço até revisão do ADMIN. Se a versão anterior já foi aprovada e a correção for aceita, iniciar novo ciclo desde a primeira etapa.
- Exigências de aprovação serão configuráveis por tipo; não presumir requisitos idênticos nos três tipos.
- Revisão administrativa por valor zero e emissão anterior ao mês corrente vale para os três tipos; referência: valor atual de NFS-e, `vNF` em NF-e e `vTPrest` em CT-e.
- Entrada de NF-e/CT-e somente pela integração nesta entrega, sem upload manual nem cadastro sem XML.
- Cobertura dos novos tipos: somente compras e fretes contratados pelas empresas, sem documentos de saída.
- Vínculos CT-e/NF-e são informativos; as aprovações são independentes, inclusive quando a NF-e referenciada ainda não estiver importada.
- Estoque de documentos aguardando configuração: após publicar o primeiro workflow, ADMIN seleciona e encaminha os elegíveis; não há encaminhamento automático desse estoque.
- Fornecedor/transportadora inexistente: autocadastro com dados do XML, como no fluxo atual. Campos mínimos e código externo dependem do mapeamento.
- Empresa não resolvida de forma única ou não cadastrada/ativa: preservar recebimento para resolução do ADMIN, bloqueando aprovação e lançamento.
- Mudança em dados que afetam lançamento após aprovação, antes de iniciar envio: nova aprovação desde o começo do workflow, com histórico preservado e versão publicada mais recente do tipo na criação do novo ciclo.
- Durante envio ou resultado incerto, bloquear alterações nos dados do lançamento até confirmar/resolver o resultado. Timeout/expiração de reserva não bastam para liberar edição ou reenvio.
- Cancelamento conhecido impede novos envios; se já lançado, ADMIN reconcilia manualmente, sem estorno automático. Se já havia envio em andamento, apurar o resultado sem presumir interrupção bem-sucedida.
- Somente ADMIN pode alterar dados operacionais que afetam o lançamento após aprovação, com motivo registrado; aplica-se a exigência de novo ciclo e o bloqueio durante envio/resultado incerto.
- ADMIN pode reabrir nota recusada e iniciar novo ciclo com a versão publicada mais recente do tipo, preservando histórico e demais impedimentos de elegibilidade.
- Consulta reaproveita vínculos de fornecedor e atribuições atuais; concessão de consulta global pelo workflow é restrita ao tipo configurado.
- Preservar operação atual de NFS-e e os limites funcionais declarados na especificação.

## Contratos atuais observados

| Área | Comportamento no checkout | Consequência para a extensão |
|---|---|---|
| Entrada | `POST /api/notas`, JSON com `xml` ou multipart `xmlFile`; aceita criação manual. `createInvoiceSchema` e parser são NFS-e; criação fixa `documentType: NFSE`. | Definir entrada por tipo e se envio manual de NF-e/CT-e faz parte da entrega. O XML deve determinar o tipo; divergência com tipo declarado precisa de resposta explícita. |
| Autenticação de entrada | Sessão ADMIN/FORNECEDOR ou chave de integração validada se configurada; sem chave configurada, o validador retorna sem rejeitar. | Não assumir autorização obrigatória já existente para o novo coletor. Fechar autenticação, operações e escopo permitidos antes de abrir o contrato novo. Não foram consultadas variáveis do ambiente. |
| Listagem de integração | `GET /api/notas` filtra status e revisão administrativa, admite XML/extras e paginação opcional. Não filtra tipo ou reserva trabalho. O handler lido não valida sessão/chave. | Identificar os consumidores e qualquer proteção externa; escolher contrato explícito para os novos tipos, sem pressupor que adicionar registros ao endpoint seja compatível. |
| Retorno de processamento | `PATCH /api/notas/[id]` aceita sessão ou chave de integração; caminho `minerium` usa `id` do payload. `PROCESSADO` marca `processada`, `CONCLUIDO` e data Delphi. | Confirmar identidade do destino, payload real do robô e semântica de sucesso/erro. Não inferir equivalência Delphi/Minerion apenas pelo alias. |
| Fornecedor | Resolvido por ID ou CNPJ de prestador; se ausente, criado automaticamente. `Supplier.cnpj` é único. Isso pode ocorrer antes da verificação de nota duplicada. | Confirmar autocadastro, código externo obrigatório e validação da associação por documento. Evitar efeitos repetidos em recebimentos duplicados. |
| Empresa | `Company.cnpj` é único; `Invoice` não tem relação direta com Company. A listagem autenticada deriva a empresa de `tomadorCnpj`. | Definir papel da empresa em cada tipo e a persistência da associação, sem sobrecarregar semanticamente `tomadorCnpj`. |
| Documento | Identificador globalmente único, XML em `Invoice`, dados extras em `InvoiceDocumentDetail` com layout e versão. | Avaliar reuso desse detalhe existente antes de criar nova estrutura; fechar consultas/indexação e precisão de itens antes de escolher JSON versus relações tipadas. |
| Aprovação | Configuração e início fixos em NFSE; ausência de configuração ativa pode retornar `LEGACY`. Publicação exige data de pagamento, OC ou contrato e avaliação do serviço. | Selecionar configuração/catálogo pelo tipo; confirmar quais exigências se aplicam aos novos documentos e o comportamento sem workflow. |
| Revisão administrativa | Valor zero e emissão anterior ao mês corrente podem reter nota antes do workflow; visibilidade depende da revisão persistida. | Confirmar aplicação por tipo e valor de referência. Não reutilizar extração de descrição de serviço como política genérica de NF-e/CT-e. |
| Fim de workflow | Última etapa marca `APROVADO` e processamento `PROCESSANDO`. | Definir se este estado significa disponibilidade ou execução em andamento e como integradores distinguem reserva e envio real. |
| Consulta e valores | Permissões combinam fornecedor, tarefa e consulta global NFSE; relatórios financeiros usam `valorServico`. | Separar alcance por tipo e definir semântica financeira para telas/relatórios existentes. |
| Execução externa | Documentação NSU atribui aquisição NFS-e a consumidor externo. Não foi inspecionado o código desse consumidor nesta fase. | Confirmar projeto/executor de FSist e Minerion, agendamento, armazenamento de cursor e quem opera falhas. |

Fontes consultadas: `src/app/api/notas/route.ts`, `src/app/api/notas/create-invoice.ts`, `src/app/api/notas/[id]/route.ts`, `src/app/api/notas/minhas/route.ts`, `src/lib/validations.ts`, `src/lib/invoice-admin-review.ts`, `src/lib/invoice-admin-review-access.ts`, `src/lib/invoice-query.ts`, `src/lib/reports.ts`, `src/app/api/relatorios/financeiro/route.ts`, `src/lib/workflow/{start,configuration,field-catalog,access}.ts`, `prisma/schema.prisma`, README e `docs/nfse-nsu-api-and-monitoring.md`.

## Matriz de dados a fechar com XMLs e Minerion

Os campos listados são categorias de mapeamento, não nomes de tags presumidos.

| Dado | NFS-e atual | NF-e | CT-e |
|---|---|---|---|
| Identidade | `codigoIdentificador` globalmente único | Chave e identidade operacional por empresa: confirmar | Chave e identidade operacional por empresa: confirmar |
| Empresa gerida | CNPJ do tomador na listagem | Papel/CNPJ da empresa: confirmar | Papel/CNPJ da empresa: confirmar |
| Fornecedor | Prestador ou ID informado | Emitente e código externo: confirmar | Transportadora/emitente e código externo: confirmar |
| Valor aprovado | Valor administrativo confirmado ou valores fiscais existentes | Campo e composição: confirmar | Campo e composição: confirmar |
| Valores e itens | Campos de serviço e extras | Produtos, quantidade/unidade, totais/tributos necessários ao destino | Transporte, carga, totais/tributos necessários ao destino |
| Dados operacionais | OC/contrato, data de pagamento, parcelas e avaliação | Obrigatoriedades e cadastros de apoio: confirmar | Obrigatoriedades e cadastros de apoio: confirmar |
| Relações | Sem fluxo CT-e/NF-e | Relações informativas quando disponíveis; aprovação independente | Exibir chaves NF-e, inclusive ausentes na plataforma, sem dependência de aprovação |
| Resultado externo | Código/data/status Delphi | Referência, destino e prova de sucesso: confirmar | Referência, destino e prova de sucesso: confirmar |

Para cada campo externo, fechar origem exata, obrigatoriedade, formato/precisão, valor ausente versus zero, mutabilidade, validação, destino e mensagem de falha. Exemplos de XML devem incluir variações e campos ausentes, além do caso feliz.

## Regras de transição propostas para alinhamento

Os termos abaixo descrevem condições operacionais; não são proposta fechada de enum/migration.

| Condição | Ação permitida proposta | Bloqueio/proteção necessária |
|---|---|---|
| Recebimento persistido, XML ainda não interpretado | Retomar parsing | Não aprovar nem enviar ao destino |
| XML inválido, tipo/situação não cobertos ou associação ambígua | Consultar falha e resolver por ação autorizada; empresa não identificada aguarda ADMIN (confirmado) | Não descartar recebimento nem presumir autorização fiscal |
| Fornecedor/transportadora inexistente, XML suficiente | Criar fornecedor pelo XML (decisão confirmada) | Unicidade sob concorrência; não inventar dados faltantes |
| Documento repetido equivalente | Retornar referência/resultado anterior | Não recriar nota, tarefa, e-mail ou lançamento |
| Mesma identidade com diferença material | Registrar conflito para resolução | Não sobrescrever XML aprovado ou payload em envio |
| Revisão administrativa pendente | Decisão administrativa conforme política por tipo | Não iniciar aprovação nem lançar |
| Sem workflow publicado para NF-e/CT-e | Aguardar configuração (decisão confirmada) | Não usar fluxo legado nem disponibilizar para lançamento; publicação não é aprovação |
| Workflow publicado e estoque aguardando configuração | ADMIN seleciona e encaminha documentos elegíveis (decisão confirmada) | Publicação não encaminha automaticamente o estoque; manter revisão/associação como pré-condições |
| CT-e com NF-e relacionada ausente ou ainda não aprovada | Seguir o workflow próprio do CT-e (decisão confirmada) | Relação informativa não cria dependência nem concede acesso ao documento relacionado |
| Workflow em andamento | Executar apenas etapa atribuída | Sem envio ao Minerion; manter versão da execução |
| Aprovado e elegível | Disponibilizar para o destino correto | Sem captura por integrador incompatível ou envio paralelo |
| Mudança material após aprovação, antes do envio | Retirar elegibilidade e exigir aprovação desde a primeira etapa com versão publicada mais recente do tipo (confirmado) | Preservar histórico e versão vinculada ao novo ciclo; serializar mudança e início de envio |
| Edição operacional após aprovação | Somente ADMIN, com motivo registrado (confirmado) | Gestor/integração não podem contornar reaprovação nem bloqueio de dados durante envio |
| Nota recusada | ADMIN pode reabrir e iniciar novo ciclo com versão publicada mais recente (confirmado) | Preservar recusa/ciclos anteriores e pré-condições de revisão, empresa e situação fiscal; sem versão publicada, aguardar configuração |
| Trabalho reservado/em envio | Executar uma tentativa identificada | Dados de lançamento bloqueados durante tentativa/resultado incerto (confirmado); confirmação por versão/reserva a especificar |
| Falha comprovada sem efeito externo | Retentar conforme classe de erro e limite | Não repetir aprovação por simples falha técnica, salvo mudança material |
| Resultado externo incerto | Reconciliar por evidência do destino | Dados bloqueados até resolver resultado (confirmado); não reenviar apenas porque houve timeout |
| Sucesso confirmado | Persistir referência e concluir | Repetição de confirmação deve ser inócua |
| Cancelamento informado | Impedir novos envios; se lançado, reconciliação manual pelo ADMIN sem estorno automático (confirmado) | Preservar histórico; tentativa já em andamento exige apuração do resultado, sem presumir interrupção |

## Contratos ainda necessários no escopo revisado

### API de recebimento e portal

- Inspecionar e documentar a autenticação, formato, respostas e validações da rota NFS-e atual; estender esse mesmo contrato aos tipos novos, sem redesenhar o consumidor.
- Definir chaves de identidade por tipo e a resposta existente para repetição equivalente/conflitante; a regra de domínio já está decidida.
- Implementar a proposta de campos mínimos para lista e detalhe do portal aprovada pelo usuário, baseada nos exemplos XML.
- Fechar associação a fornecedor/transportadora, campos mínimos para autocadastro e permissões; a empresa não resolvida aguarda ADMIN.
- Definir armazenamento e recuperação de XML válido cuja situação fiscal esteja pendente, além de XML malformado/não parseável ou tipo não suportado.
- Fechar a apresentação e bloqueios dos CT-e de substituição, inclusive quando o CT-e original já estiver aprovado.
- Definir estados da nota entre recebimento, revisão, espera de workflow e aprovação/recusa, incluindo operação quando ainda não existe workflow publicado.

### Dados aprovados para a interface

- Lista: tipo e número/chave; fornecedor ou transportadora; empresa/estabelecimento; emissão; valor de referência; situação informada no XML; estado da revisão/workflow.
- Detalhe: XML original conforme permissão; dados fiscais; NF-e com itens, quantidades e totais; CT-e com tomador, remetente, recebedor, trajeto, carga, componentes do frete, NF-e referenciada e vínculo de substituição; NFS-e com os campos já apresentados hoje.
- O usuário aprovou esta proposta para compor o plano. Rótulos, organização visual e responsividade ficam para o desenho de UX/implementação, preservando estes dados e as permissões existentes.

### Integrações explicitamente fora do escopo

FSist como origem/coletor e Minerion/Delphi como destino de lançamento não são dependências para concluir este plano. A API recebe documentos de seu consumidor; contratos de coleta e de lançamento serão tratados em outro escopo.

### FSist (adiado; não bloqueia este plano)

- Interface de consulta/download e autenticação; empresa/estabelecimento e tipos cobertos; históricos, frequência e volume.
- Cursor/paginação, ordenação, expiração, documentos tardios e cobertura de XML completo versus resumos/eventos.
- Identificadores, situação retornada, limites, erros recuperáveis e recuperação de lacunas.
- Onde roda o executor, quem guarda recebimentos/checkpoint e como a plataforma reconhece um recebimento já concluído.

### Minerion e consumidor atual (adiado; não bloqueia este plano)

- Destino Delphi/Minerion e executor `rpa-web` confirmados; falta inspecionar nomes/versões dos consumidores e exemplos de consulta de pendências/callback atuais.
- Interface real de lançamento, mapeamentos por tipo, cadastros auxiliares e evidência de sucesso.
- Idempotência suportada, consulta por identidade/referência e tratamento de confirmação perdida.
- Reserva de trabalho, payload imutável da tentativa, prazo, reconciliação e intervenção manual auditada.

### Plataforma

- Contrato aditivo/versão nova versus extensão das rotas existentes; campos e filtros por tipo, autenticação e limites.
- Permissões de consulta confirmadas: reaproveitar vínculos/atribuições; consulta global pelo workflow limitada ao tipo. Traduzir essas regras em autorização consistente de APIs/serviços, incluindo XML, exportação e relações entre documentos.
- Revisão por valor zero/data antiga confirmada nos três tipos; definir valor de referência dos novos documentos. Entrada manual dos novos tipos fora da entrega. Autocadastro de fornecedor confirmado; definir campos mínimos e opções de exigências por tipo.
- Nova aprovação após mudança material confirmada, com versão publicada mais recente e bloqueio de alterações durante envio/resultado incerto. Ator autorizado: somente ADMIN com motivo; reabertura de recusa pelo ADMIN também confirmada. Definir lista de campos materiais, payloads e controles de concorrência. Cancelamento conhecido já tem política de bloqueio/reconciliação manual, mas contrato da informação continua pendente.

### Impacto de reaprovação no schema atual

`InvoiceWorkflow.invoiceId` é único em `prisma/schema.prisma`; `enrollmentError` também impede novo encaminhamento quando já existe workflow. A regra confirmada de reaprovação exige planejar ciclos ou histórico equivalente, sem apagar aprovações/tarefas anteriores ou permitir que comandos do ciclo anterior avancem o novo. Essa decisão altera o escopo da Fase 1 (persistência/concorrência), da Fase 3 (gestão e execução) e da Fase 4 (envio condicionado à aprovação dos dados vigentes).

Cada ciclo novo resolve a versão publicada mais recente na criação e mantém essa associação. Publicar outra versão depois não migra silenciosamente o ciclo em andamento. Retorno tardio de comando/callback precisa identificar o ciclo/tentativa a que pertence. O protocolo externo para isso ainda depende dos contratos pendentes.

## Próximas decisões em ordem

As rodadas funcionais desta conversa estão consolidadas em `spec.md` (DR-8 a DR-21 e cenários correspondentes). Não tratar as pendências técnicas abaixo como decisões de negócio já aprovadas nem declarar a Fase 0 integralmente concluída.

1. Manter materiais FSist/Minerion pendentes conforme orientação; destino e executor já confirmados.
2. Fechar requisitos detalhados de etapas/campos por tipo; encaminhamento do estoque após configuração já confirmado como seleção pelo ADMIN.
3. Fechar critérios técnicos de empresa/fornecedor para a cobertura confirmada (compras/fretes); relações CT-e/NF-e já confirmadas como informativas e independentes. Extrair matriz de campos externos quando os materiais estiverem disponíveis.
4. Validar recuperação da coleta e reconciliação do lançamento contra as capacidades reais das integrações.
5. Fechar payloads, autorização, persistência e transições; incorporar as decisões na especificação e cenários de aceite.
6. Definir piloto, volume, critérios de ativação e compatibilidade com consumidores antigos.

### Situação consolidada dos entregáveis

| Entregável | Situação | Trabalho restante |
|---|---|---|
| Cobertura, entrada e workflow por tipo | Regras principais confirmadas | Detalhar catálogos, exigências configuráveis e representação da espera por configuração |
| Permissões, reabertura e reaprovação | Regras confirmadas | Contratos de comandos, ciclos, revisões concorrentes e invalidação da aprovação anterior |
| Situação fiscal e envio | Política de cancelamento/bloqueio confirmada | Fonte da informação, elegibilidade detalhada, reserva, callback e reconciliação externa |
| XML, valores, itens e cadastros | Parcial, depende dos materiais adiados | Matriz campo a campo, referência monetária, precisão, layouts cobertos e campos mínimos de fornecedor |
| Identidade e repetição | Objetivo de ausência de duplicidade definido | Identidade operacional por empresa, comparação de XMLs conflitantes e garantias reais do destino |
| Contratos FSist/Minerion e robô | Pendente por orientação do usuário | Documentação/exemplos e inspeção do consumidor `rpa-web`, sem presumir endpoints ou capacidades externas |
| Migração e ativação | Pendente de desenho técnico e capacidade/volume | Compatibilidade de consumidores, legado sem tipo, implantação aditiva, piloto e recuperação |

Não é necessário repetir agora as perguntas sobre materiais externos que o usuário pediu para manter pendentes. O próximo trabalho técnico pode detalhar o contrato interno e as alternativas de persistência, preservando como pendentes os campos e garantias que dependem das integrações.

## Critério de conclusão da Fase 0 revisado

### Respostas ainda pendentes do usuário


Fase concluída quando o contrato de recebimento da API, autenticação e idempotência estiverem definidos; os dados necessários à exibição/aprovação dos três tipos estiverem mapeados; regras de associação, acesso e estados estiverem fechadas; e os cenários de aceite refletirem o escopo. Contratos de FSist e Minerion não são critérios desta Fase 0 revisada.

Verificação nesta etapa: leitura dos contratos/código local e conferência documental. Sem migrations, testes de integração, chamadas a FSist/Minerion ou alterações no código de produto.
