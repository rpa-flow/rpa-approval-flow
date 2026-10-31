# Revisão administrativa de notas com valor zerado ou emissão anterior ao mês corrente

Status: proposta para aprovação; somente planejamento autorizado em 25/10/2026.

## Objetivo e limites

Para todos os fornecedores, tentar extrair uma sugestão da descrição de toda nota com valor zerado. Reter para validação ADMIN tanto essas notas quanto as emitidas antes do mês corrente, avisando o e-mail administrativo configurado. Somente disponibilizar a nota ao gestor depois de resolvidos todos os motivos de revisão.

Fora de escopo: alterar XML ou tributos, aprovar automaticamente pelo gestor, regras para qualquer fornecedor por nome, IA para interpretar valores, corrigir retroativamente notas processadas e alterar integrações externas sem contrato alinhado.

## Evidências e decisões abertas

- Análise histórica do XML: vServ e vLiq eram 0.00; a descrição continha “Valor total R$ 539.79”, compra de crédito no mesmo valor e serviço zerado. O XML original não foi reaberto nesta etapa.
- Código atual: src/lib/nfse-parser.ts lê vServ/vLiq e extrai descricaoServico; create-invoice.ts persiste esses valores, inicia AGUARDANDO_APROVACAO e envia aviso aos contatos do fornecedor.
- Existem configurações de avisos globais/por fornecedor, serviço de e-mail, auditoria e histórico; não existe estado próprio de revisão de valor.
- GET /api/notas tem consumidores de integração; detalhe, histórico, exportação, relatórios e lembretes são caminhos distintos. Todos precisam respeitar a retenção administrativa.
- Há alterações locais prévias em parser, APIs e dashboard. Preservá-las e revisar a compatibilidade antes da implementação.
- Decisão do usuário: aplicar a todos os fornecedores, sem seleção por CNPJ; valor zerado e emissão anterior ao mês corrente são gatilhos independentes de retenção e aviso.
- Propostas: usar um destinatário global para revisão; tratar o valor confirmado como valor operacional para aprovação, separado do fiscal. Para definir valor zerado, usar o valor efetivo destinado à aprovação (prioridade atual: valorServico, valorLiquido, valorBaseCalculo), distinguindo zero explícito de ausência; valores fiscais conflitantes ficam evidenciados para o ADMIN, sem escolher silenciosamente outro campo positivo.
- Dados necessários para ativação: e-mail destinatário. Confirmar também o tratamento das notas já cadastradas e quais campos o consumidor Delphi deve receber para o valor operacional.

## Fluxo e regras de domínio

Importação → revisão administrativa pendente → ADMIN confirma → aprovação normal do gestor.

- DR-1: configuração global restrita a ADMIN, com e-mail obrigatório e válido antes da ativação do fluxo. As duas regras abrangem todos os fornecedores, sem opt-out por fornecedor. Configuração ausente ou falha no transporte de e-mail não pode liberar uma nota enquadrada; registrar a pendência de aviso.
- DR-2: quando o valor efetivo destinado à aprovação for explicitamente zero, reter a nota e tentar extrair sugestão da descrição, independentemente do fornecedor, canal de entrada ou sucesso da extração. Ausência de valor não equivale a zero. A decisão considera os dados de origem antes de qualquer sugestão; encontrar valor positivo no texto não dispensa revisão. Nota já recusada na entrada mantém sua recusa e não se torna elegível à aprovação por esta validação; se atender aos gatilhos, registrar revisão e aviso sem reabrir a nota automaticamente.
- DR-3: procurar o rótulo explícito “Valor total” na descrição do serviço. Aceitar formatos monetários BR e o decimal com ponto observado no XML, com cálculo decimal/centavos. Nunca selecionar o primeiro ou maior número. Repetições idênticas podem ser consolidadas; totais divergentes, formato ambíguo ou ausência de total deixam a sugestão vazia e a revisão pendente. Compra de crédito serve como evidência complementar, não como fallback automático.
- DR-4: preservar xmlOriginal, valorServico, valorLiquido e tributos. Persistir sugestão, trecho/rótulo de origem e versão do extrator. Valor confirmado é um campo operacional separado, com origem explícita. Não presumir igualdade entre compra de crédito e valor fiscal do serviço.
- DR-5: pendências ficam invisíveis ao GESTOR em listas, contadores, detalhe por URL, histórico, relatórios, exportações e respostas alternativas. Não enviar e-mails/lembretes ao gestor nem permitir aprovação ou processamento por PATCH genérico/integração. ADMIN pode consultar a fila. FORNECEDOR pode acompanhar o próprio envio conforme acesso atual, sem liberar ou alterar a revisão.
- DR-6: ADMIN visualiza todos os motivos, valores fiscais, descrição completa, sugestão, origem e data de emissão. Para valor zerado, confirma sugestão ou informa valor positivo com duas casas decimais; divergência exige justificativa. Para emissão anterior, confirma explicitamente ciência e autorização de prosseguimento, com justificativa, sem mudar a data original. Se houver apenas emissão anterior, não exigir edição de valor. Pode manter pendente com observação. Liberação exige resolver todos os motivos e nunca equivale à aprovação do gestor.
- DR-7: confirmação, autoria, data, justificativa, auditoria e liberação devem ser atômicas. Revisão concorrente/obsoleta retorna conflito; repetição idempotente não duplica liberação ou aviso. Demais regras de aprovação, incluindo data de pagamento e OC/contrato, continuam valendo depois da liberação.
- DR-8: aviso administrativo contém identificação, fornecedor, todos os motivos, data de emissão, valor original, sugestão (ou indicação de não encontrada) e link autenticado. Uma nota que atende aos dois gatilhos gera uma revisão e um aviso inicial consolidado, não dois e-mails. Reutilizar transporte existente; registrar destinatário, tipo, tentativas e resultado. Falha de envio mantém a nota retida e permite reenvio administrativo, sem duplicar nota. Destinatário do aviso não ganha acesso ADMIN por receber e-mail.
- DR-9: após liberação, notificar os gestores pelo fluxo normal e iniciar a contagem dos lembretes a partir da disponibilização, evitando cobrança retroativa. Usar valor operacional confirmado nas superfícies de aprovação e totais operacionais, com indicação da origem; mostrar valores fiscais separadamente. Relatórios fiscais mantêm seus campos originais.
- DR-10: mudança do destinatário vale para novos envios/reenvios, preservando histórico. Notas já cadastradas não são alteradas automaticamente: inclusão específica exige seleção e revisão, impedida se já aprovada/processada, salvo novo escopo autorizado.
- DR-11: reter também toda nota cuja data civil de emissão seja anterior ao primeiro dia do mês corrente em America/Sao_Paulo, mesmo com valor positivo. Comparar mês e ano da emissão, nunca competência, vencimento ou idade em dias. Capturar o mês de referência ao receber a nota e persistir essa referência; datas sem horário conservam o dia informado, timestamps são normalizados no fuso definido. Em 25/10/2026, emissão até 30/09/2026 exige revisão e a partir de 01/10/2026 não aciona este motivo. Data ausente/inválida não deve ser interpretada como antiga: preservar a validação existente e sinalizar a impossibilidade de avaliação.
- DR-12: a virada do mês não reabre automaticamente notas já disponibilizadas ou validadas. Avaliar os gatilhos na entrada; inclusão retroativa depende de escopo específico. Correções de origem durante uma revisão pendente exigem reavaliação e controle de versão antes de liberar. Extração por descrição só é necessária para o motivo de valor zerado.

## Contratos e persistência propostos

- Configuração global de revisão, sem vínculo por fornecedor e separada de emailsExtras/destinatarioAdicional, que hoje atendem avisos comuns. Novas rotas GET/PUT /api/configuracoes/revisao-notas, restritas a ADMIN, com validação Zod e auditoria de mudanças.
- Revisão vinculada à nota: estado PENDENTE/LIBERADA, motivos VALOR_ZERADO e/ou EMISSAO_ANTERIOR, mês/fuso de referência, data original avaliada, valor sugerido/confirmado opcional Decimal(14,2), evidência, versão da regra, autor, justificativa, datas e versão para concorrência. Ausência de revisão indica nota fora desse fluxo. Preservar InvoiceStatus para não quebrar consumidores; o bloqueio administrativo é uma condição independente e obrigatória.
- GET /api/notas/revisoes para fila ADMIN; POST /api/notas/[id]/revisao para confirmar com { valorConfirmado?: string decimal, confirmarEmissaoAnterior?: boolean, justificativa?, versao }. Exigir valor positivo para VALOR_ZERADO e confirmação explícita com justificativa para EMISSAO_ANTERIOR; ambos quando aplicável. Não permitir valor novo para revisão exclusivamente de emissão. Validar motivos no servidor, sem aceitar que o cliente os remova. Não expor campos de revisão como livre edição no PATCH existente. Respostas: 400 validação, 401/403 autorização, 404 nota inacessível, 409 revisão concorrente/estado inválido.
- Acrescentar valorParaAprovacao e origemValor às respostas pertinentes, com fallback explícito ao comportamento atual em notas sem revisão. Validar adoção no consumidor Delphi antes de ativar para processamento; não remapear silenciosamente valorServico/valorLiquido.
- Centralizar predicados de visibilidade/liberação e resolução de valor para evitar divergência entre telas, notificações e relatórios. Acesso global a relatórios não dispensa o bloqueio para GESTOR.
- Migration aditiva versionada; nenhuma correção massiva ou acesso à produção nesta etapa. Revisão e registro durável de notificação criados na mesma transação. Envio após commit, com chave única por evento/destinatário e reenvio controlado. Não prometer entrega exatamente uma vez pelo SMTP; falha após envio pode exigir reconciliação antes de repetir.

## Critérios de aceite

- AC-1: Dada nota de qualquer fornecedor com valor efetivo zero, quando importar a descrição do exemplo, então sugerir R$ 539,79, manter os valores fiscais e reter a nota, avisando somente o destinatário administrativo. Repetir para fornecedor diferente da Swile e para entrada manual com descrição disponível; sem descrição, reter e avisar sem sugestão.
- AC-2: Dada descrição com total, desconto e serviço zero, quando extrair, então usar somente o total explícito; totais conflitantes ou texto sem total deixam sugestão vazia e não liberam a nota.
- AC-3: Dado GESTOR, inclusive com acesso global a relatórios, quando consultar qualquer superfície ou tentar PATCH de nota retida, então não receber seus dados nem conseguir aprová-la. Integração também não processa a nota retida.
- AC-4: Dado ADMIN e revisão pendente, quando confirmar valor válido, então gravar valor operacional/autoria/evidência e liberar atomicamente; gestor passa a visualizar a nota e precisa aprová-la normalmente.
- AC-5: Dados dois administradores ou retry da mesma requisição, quando confirmarem a revisão, então somente uma decisão produz efeitos e aviso, com conflito explícito na versão obsoleta.
- AC-6: Dada falha no e-mail, quando importar, então a nota permanece salva e retida, com falha visível e reenvio disponível. Falha no aviso ao gestor após liberação também é rastreável.
- AC-7: Dada nota com valor positivo e emissão no mês corrente, quando importar, então preservar o fluxo atual para qualquer fornecedor, sem revisão nem aviso administrativo por estes motivos.
- AC-8: Dado e-mail inválido/ausente, quando ativar a regra, então impedir a gravação. Usuário não ADMIN não altera configuração nem confirmação.
- AC-9: Dada nota liberada, quando abrir dashboard, detalhe, e-mail e exportação operacional, então os valores conferem em centavos e identificam a origem administrativa; XML e dados fiscais permanecem intactos.
- AC-10: Dada nota legada aprovada/processada, quando tentar inclusão retroativa, então impedir alteração por este fluxo. Nova importação duplicada mantém conflito sem duplicar revisão/aviso.
- AC-11: Dado mês corrente outubro/2026 em São Paulo e valor positivo, quando importar nota emitida em 30/09/2026, então reter e avisar por emissão anterior; nota de 01/10/2026 não aciona esse motivo. Cobrir dezembro/janeiro, timestamps próximos à meia-noite e datas sem horário.
- AC-12: Dada nota zerada e emitida em mês anterior, quando importar, então criar uma revisão com os dois motivos e um aviso consolidado. Confirmar somente valor ou somente emissão não libera a nota.
- AC-13: Dada nota retida somente por emissão anterior, quando ADMIN confirmar com justificativa, então liberar sem alterar valores nem data de emissão e registrar a decisão.
- AC-14: Dada nota já liberada, quando virar o mês, então não retê-la novamente. Dada configuração de e-mail ausente ou falha de envio, quando uma nota atender a qualquer motivo, então manter bloqueio e pendência de notificação visíveis ao ADMIN.

## Plano de implementação e verificação

1. Fechar decisões restantes: destinatário, semântica do valor operacional, notas já cadastradas e contrato Delphi. Abrangência global e dois gatilhos já definidos pelo usuário. Revalidar alterações locais e todos os consumidores de Invoice, inclusive suporte, dashboards e exportações.
2. Banco e domínio: migration aditiva, regras de extração e comparação de mês/fuso puras, configuração global validada, revisão com múltiplos motivos/auditoria/notificação durável e transações com controle de concorrência.
3. API e integração: interceptar importação antes de qualquer aviso; aplicar bloqueio em leituras, mutações, relatórios, histórico e processamento; confirmar revisão em endpoint ADMIN; alinhar valor operacional com consumidores externos.
4. Interface: seção “Revisão de notas” nas configurações e fila ADMIN com filtros por motivo; formulário com descrição/evidências, data de emissão/mês de referência e confirmações exigidas por motivo, justificativa e estados de carregamento/erro. Reutilizar design system e detalhe atual, sem redesenho lateral.
5. Avisos: template administrativo, envio após persistência, falhas/reenvio visíveis e encaminhamento ao gestor após liberação. Separar contadores e relógio de lembretes da revisão administrativa.
6. Verificar AC-1 a AC-14 com fixtures sintéticas; cobrir formatos monetários, fronteiras de mês/ano/fuso, motivos combinados, permissões, bypass por API/URL, concorrência, rollback, falha de SMTP e compatibilidade. Existem arquivos de testes focados, mas não há npm test configurado: definir execução compatível sem prometer suíte existente. Executar lint, typecheck/build proporcionalmente, sem ler .env nem usar banco real para testes.
7. Ativar de forma controlada após validação: configurar e-mail global; decidir inclusão explícita das notas já cadastradas; monitorar pendências/falhas. Planejar rollback sem expor notas retidas: não retornar a uma versão que ignore o bloqueio sem suspender previamente as superfícies de acesso/processamento afetadas.

## Limitações desta etapa

Inspeção estática do checkout local e memória histórica. Sem XML original anexado nesta conversa, sem verificação em produção, sem envio de e-mail, sem migrations executadas e sem alteração de código do produto. Implementação depende de autorização explícita posterior do usuário.
