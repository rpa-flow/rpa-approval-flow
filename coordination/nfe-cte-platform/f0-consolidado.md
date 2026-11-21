# Fase 0 — contrato consolidado para aprovação de documentos

Estado: Fase 0 de planejamento concluída em 20/11/2026, com decisões de negócio e desenho inicial consolidados. Os riscos e verificações abaixo acompanham as próximas fases; não são evidência de implementação ou homologação. Esta é a referência vigente para o escopo atual; documentos anteriores preservam o histórico e suas referências a lançamento externo não são requisitos desta entrega.

## Escopo e comportamento

A plataforma recebe NFS-e, NF-e e CT-e via API e apresenta os documentos para revisão e aprovação. A coleta e o lançamento externo estão fora deste plano. A entrada de NF-e/CT-e é exclusivamente via integração. As exigências, permissões de consulta global e versões de workflow são separadas por tipo. Estoque sem workflow publicado aguarda seleção do ADMIN após publicação; novas notas elegíveis iniciam o workflow já publicado.

Regra de elegibilidade confirmada em 20/11/2026: basta o XML identificar uma empresa ativa cadastrada como destinatária da NF-e ou como tomadora do CT-e para considerar o documento dentro do escopo de compras/fretes e permitir o início automático do workflow publicado, desde que os demais bloqueios deste contrato estejam resolvidos. Não exigir lista de CFOPs ou confirmação manual de escopo. Empresa ausente, inativa ou ambígua permanece pendente do ADMIN; documentos de saída não entram no escopo.

O XML e os dados fiscais originais são preservados. Documento cancelado, não autorizado ou com situação desconhecida é recebido e exibido como pendente, sem iniciar aprovação. O ADMIN resolve associação de empresa não encontrada ou ambígua. Revisão administrativa por valor zero ou emissão anterior ao mês corrente aplica-se aos três tipos; valores de referência: regra NFS-e atual, `vNF` para NF-e e `vTPrest` para CT-e. Ausência não é zero.

## Contrato existente e adaptação

`POST /api/notas` delega a `createInvoiceFromRequest`: aceita JSON com `xml` ou multipart com `xmlFile`, além de criação manual NFS-e; validação e leitura inválidas retornam 400, duplicata retorna 409, criação retorna 201. Resposta omite XML salvo `includeXml=true`. A autenticação atual admite sessão ADMIN/FORNECEDOR; sem sessão, valida `x-api-key` quando configurada, mas a ausência da configuração não rejeita a chamada. Decisão do usuário: a chave de integração deve estar configurada. Para recepção sem sessão, exigir configuração e chave válida nos três tipos; não permitir acesso anônimo quando ausente. Preservar acesso por sessão autorizada existente. Não foram lidas configurações de ambiente; a mudança elimina o comportamento anterior de acesso sem chave configurada e exige atenção na implantação.

Para os novos tipos, detectar o documento pelo XML, aceitar os mesmos envelopes e autenticação e manter 201 para criação. Para reenvio equivalente, proposta técnica: retornar 200 com o documento existente, sem criar tarefas ou notificações; para mesma identidade e conteúdo diferente, registrar versão candidata e retornar 409 com referência do conflito, sem sobrescrever. O 409 atual para repetição idêntica muda: avaliar compatibilidade antes de ativar a nova semântica para NFS-e existente. XML malformado ou tipo não reconhecido mantém resposta 400; documento interpretável com situação fiscal pendente é persistido e identificado como pendente. Não registrar XML integral ou credenciais em logs.

## Modelo de dados proposto

- Tabela central: identidade, tipo, número, empresa vinculada quando resolvida, fornecedor, emissão, valor de referência, estado de aprovação/revisão e ponteiro para versão corrente. Manter campos existentes durante transição; não atribuir semântica de serviço a valores de NF-e/CT-e.
- Uma tabela de detalhe por tipo vinculada ao documento: NFS-e preserva os campos atuais e `InvoiceDocumentDetail` conforme compatibilidade; NF-e armazena partes, totais e itens; CT-e partes, tomador, trajeto, carga, componentes do frete e referências. XML bruto por versão, dados extraídos e versão do parser são preservados. Definir precisão suficiente para quantidades e preços unitários, além de totais em centavos.
- Empresa: NF-e associa pelo CNPJ do destinatário; CT-e resolve o tomador indicado pelo XML entre seus participantes, inclusive quando definido explicitamente. NFS-e mantém sua regra de tomador. Empresa ausente, inativa ou ambígua fica pendente de ADMIN. Fornecedor é emitente/prestador; criar pelo XML quando identificação e nome forem suficientes, com unicidade por CNPJ e tratamento concorrente. Dados insuficientes aguardam ADMIN.
- Identidade: chave de acesso de 44 dígitos para NF-e/CT-e, preservando zeros; NFS-e mantém o identificador normalizado existente, inclusive layouts já suportados. A unicidade deve ser imposta no banco e resolver corrida de criação; verificar colisões com o identificador global atual antes de alterar a restrição. Não criar documentos fictícios para referências ausentes.
- Versões: guardar XML, hash e estado de revisão; comparação por bytes idênticos é reenvio equivalente; variações de serialização devem ser tratadas conservadoramente como conflito até haver comparação semântica demonstrada. Em conflito, manter a versão ativa e suspender o ciclo. ADMIN decide; aceitação durante ou após aprovação exige novo ciclo desde a primeira etapa com versão publicada mais recente, sem apagar histórico nem reutilizar aprovações anteriores.
- Relações: referência CT-e/NF-e é informativa e não concede acesso. Substituto referencia chave do CT-e original, inclusive ainda ausente; ao resolver vínculo, marcar original substituído e impedir novo avanço, preservando o histórico. Se original já aprovado, preservar evidências e sinalizar ADMIN; não presumir efeito externo.
- Workflow: substituir a restrição de uma execução por nota por suporte a ciclos históricos e garantia de apenas um ciclo ativo por documento. Cada ciclo referencia versão de configuração e versão de documento. Comandos de ciclo anterior não avançam ciclo novo. Garantir concorrência entre revisão, substituição e aprovação.

## Mapeamento para portal

| Tipo | Dados de identificação e empresa | Valor e detalhe |
|---|---|---|
| NFS-e | Identificador e número extraídos pelos parsers existentes; prestador e tomador | Regra atual de revisão usa primeiro valor de serviço, líquido e base disponíveis; preservar campos atuais e histórico. |
| NF-e | `infNFe/@Id`/chave, `ide/nNF`, `emit`, `dest`, emissão | `ICMSTot/vNF`; itens `det/prod`, quantidades, unidades e totais; situação/protocolo informados. |
| CT-e | `infCte/@Id`/chave, `ide/nCT`, `emit`, partes e tomador | `vPrest/vTPrest`, componentes, carga, trajeto, referências `infDoc/infNFe` e `infCteSub/chCte`. |

Lista apresenta tipo, número/chave, fornecedor, empresa, emissão, valor, situação e estado de revisão/workflow. Detalhe apresenta dados específicos e XML conforme autorização. Informação fiscal declarada no XML não comprova situação atual na SEFAZ. Acesso a nota relacionada exige autorização própria.

## Migração e ativação

1. Fazer migração aditiva, introduzindo tabelas por tipo, vínculo de empresa, versões e ciclos, sem remover campos existentes. Preservar APIs e NFS-e atuais durante transição.
2. Preencher detalhes NFS-e a partir dos dados existentes com reconciliação por contagem e amostragem. Não classificar automaticamente registros nulos sem evidência; deixar exceções para avaliação. Evitar sobrescrita de XML e históricos.
3. Migrar relações de workflow sem apagar tarefas ou aprovações e garantir unicidade de ciclo ativo. Validar execução já em andamento antes de ativar novos tipos.
4. Ativar NF-e/CT-e gradualmente após verificar lista, detalhes, permissões e compatibilidade de consumidores das APIs existentes. Evitar que consumidores atuais recebam tipos que não entendem. Suspender ativação sem apagar dados; não reverter migrations destrutivamente em banco populado.

## Critérios de aceite e verificação futura

Receber os exemplos de cada tipo e exibir os campos aprovados; repetição concorrente não duplica documentos ou notificações; XML divergente cria pendência com versão anterior preservada; empresa ausente e situação não autorizada impedem workflow; publicação por tipo respeita estoque e novos documentos; substituição funciona nas duas ordens de chegada; relação NF-e/CT-e não bloqueia aprovação nem concede acesso; reaprovação preserva ciclos; NFS-e legado mantém seu comportamento. Verificar formatos e autenticação da API, acessos de ADMIN, gestor e fornecedor, migração, relatórios/listagens existentes e build. Os exemplos disponíveis não demonstram todos os layouts fiscais.

## Limites e verificações para as próximas fases

- A equivalência de XML com diferenças de formatação e a resposta HTTP para NFS-e repetida precisam de avaliação de compatibilidade; a proposta conservadora está acima.
- Cobertura de compras/fretes é identificada pelo papel da empresa ativa cadastrada no XML (destinatária NF-e ou tomadora CT-e), conforme decisão acima; ausência ou ambiguidade permanece pendente. Formatos de situação fiscal não reconhecidos continuam pendentes; a declaração no XML não prova situação atual na SEFAZ.
- A chave de ingestão não é obrigatória quando ausente na configuração atual. A decisão de exigi-la para recepção sem sessão altera esse comportamento também para NFS-e; verificar configuração e consumidores existentes antes de ativar, sem ler ou expor segredos.
- A amostra CT-e de substituição aponta para chave terminada em `...424841000569508`; o CT-e normal compartilhado termina em `...423951000568240`. Portanto, não há vínculo entre esses dois exemplos. A afirmação anterior de que um substituía o outro estava incorreta.
