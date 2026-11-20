# Relatório de auditoria estática de segurança

**Data:** 19/11/2026  
**Escopo:** frontend e backend Next.js/TypeScript, autenticação e autorização, APIs, Prisma/PostgreSQL, integrações, dependências, dados fiscais e arquivos de configuração versionados.

## Resumo executivo

A revisão identificou **1 vulnerabilidade Crítica e 3 Altas**. Os achados mais urgentes são uma versão do Next.js atingida por advisory crítico de execução remota de código, uma listagem de notas sem autenticação e uma ingestão que aceita requisições anônimas quando sua chave opcional não está configurada. A assinatura das sessões também usa um segredo fixo de fallback, permitindo falsificação de sessão se `AUTH_SECRET` estiver ausente.

Não foram encontrados sinks explícitos de XSS (`dangerouslySetInnerHTML`/`innerHTML`) nem chamadas SQL raw não parametrizadas nas buscas estáticas realizadas. As queries raw observadas usam template tag do Prisma. Não foram lidos arquivos `.env` nem expostos valores de segredos. A auditoria não acessou produção, não executou testes e não verificou os valores de configuração existentes na Vercel ou no Neon.

## Crítica

### SBP-001 — Next.js está em versão afetada por RCE crítica

- **Localização:** `package.json:24`; versão instalada também registrada em `package-lock.json:5090-5091`.
- **Evidência:** a dependência está fixada em `next` `14.2.33`. O advisory oficial GHSA-2464-fhr4-w9xw/CVE-2026-96889 informa que versões `>=10.0.0 <=15.5.27` são afetadas por execução remota de código associada à otimização de imagens SVG em Linux baseado em glibc; a correção indicada é `15.5.28` ou `16.4.1` ([advisory oficial](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw)). A política oficial marca Next.js 14 como sem suporte ([política de suporte](https://nextjs.org/support-policy)).
- **Impacto e cenário:** se o ambiente de produção satisfizer os pré-requisitos do advisory e expuser o endpoint de otimização de imagens, uma requisição especialmente construída pode comprometer o processo da aplicação, afetando confidencialidade, integridade e disponibilidade dos dados fiscais e credenciais acessíveis a ele.
- **Correção recomendada:** atualizar o Next.js para uma versão corrigida e suportada, revisar compatibilidade de React/Next e regenerar o lockfile. Antes da implantação, confirmar que o runtime e o fluxo de otimização de imagens correspondem aos pré-requisitos descritos pelo advisory. A condição de execução em produção não foi verificada nesta auditoria.
- **Prioridade:** P0 — tratar antes de expor a aplicação a novos clientes.

## Alta

### SBP-002 — Listagem de notas fiscais não exige sessão nem restringe escopo

- **Localização:** `src/app/api/notas/route.ts:31-52`, especialmente `48-52`; XML opcional em `11-12`, `25-27` e `83-85`.
- **Evidência:** o handler `GET` valida apenas o filtro de status e executa `prisma.invoice.findMany` com `where` derivado de `combineInvoiceWhere(...)`. Não consulta a sessão nem aplica escopo por usuário. Com `?includeXml=true`, serializa o XML original sem removê-lo.
- **Impacto e cenário:** qualquer cliente que alcance a rota pode enumerar notas e obter dados de fornecedores, tomadores, valores e outros campos fiscais; com `includeXml=true`, também pode obter o XML fiscal. A paginação é opcional, portanto a resposta pode incluir toda a coleção.
- **Correção recomendada:** exigir sessão e autorização no handler, aplicar o escopo do usuário em toda consulta e exportação correspondente, limitar campos de resposta por perfil e retornar XML somente após autorização específica.
- **Prioridade:** P1 — corrigir imediatamente e revisar logs de acesso existentes para avaliar exposição anterior.

### SBP-003 — Ingestão de notas aceita chamadas anônimas quando a chave está ausente

- **Localização:** `src/app/api/notas/create-invoice.ts:51-60` e `75-80`; endpoint adicional `src/app/api/notas/recusadas/route.ts:5-11`; configuração de exemplo `.env.example:22-23`.
- **Evidência:** `validateInvoiceIngestApiKey` retorna `null` quando `INVOICE_INGEST_API_KEY` não está configurada (`53`). O fluxo só rejeita quando não há sessão **e** há resposta de não autorizado (`76-78`), então uma chamada anônima é aceita com a variável vazia. O exemplo versionado marca a chave como opcional e vazia. A mesma função é usada pelo endpoint de notas recusadas.
- **Impacto e cenário:** se a chave não for definida no ambiente, um atacante externo pode enviar notas arbitrárias sem sessão, incluindo dados fiscais e XML, provocar criação de fornecedores quando não encontrados e alimentar o fluxo de aprovação com registros falsos. A rota de recusadas também cria registros sem identidade autenticada.
- **Correção recomendada:** separar claramente ingestão de robô e lançamentos pela interface; exigir chave válida para chamadas sem sessão e falhar no início do serviço quando a configuração obrigatória estiver ausente. Tornar a verificação obrigatória no ambiente de produção e aplicar limites de tamanho e frequência apropriados.
- **Prioridade:** P1 — validar a configuração atual e fechar o comportamento fail-open antes de novos clientes.

### SBP-004 — Segredo fixo de fallback permite forjar sessões se `AUTH_SECRET` faltar

- **Localização:** `src/lib/auth.ts:5-6`, `51-59` e `62-72`.
- **Evidência:** quando `AUTH_SECRET` está ausente, a aplicação usa o valor fixo `dev-secret-change-me` para assinar e verificar cookies de sessão. `getSessionManager` resolve o `managerId` assinado contra o banco e retorna o usuário ativo (`75-95`).
- **Impacto e cenário:** qualquer pessoa que conheça o fallback pode assinar um payload de sessão com o identificador de um usuário ativo e representar essa conta, inclusive um administrador, caso a configuração de produção esteja ausente ou igual ao valor de desenvolvimento.
- **Correção recomendada:** remover o fallback fixo, validar segredo forte obrigatório no startup em ambientes compartilhados/produção, falhar de forma fechada e rotacionar sessões/secrets se a configuração atual tiver usado o valor padrão.
- **Prioridade:** P1 — confirmar o estado de `AUTH_SECRET` na Vercel sem revelar seu conteúdo e corrigir antes de ampliar o acesso.

## Média

Nenhum achado Médio comprovado nesta revisão estática.

## Baixa

Nenhum achado Baixo comprovado nesta revisão estática.

## Riscos que exigem validação ou decisão de arquitetura

- **Aplicabilidade operacional do SBP-001:** confirmar no ambiente de implantação se o runtime é Linux glibc e se a otimização de imagens Next.js está acessível e processa SVG. A versão instalada é afetada; esses pré-requisitos de exploração não foram validados fora do repositório.
- **Configuração Vercel/Neon:** não há `vercel.json` versionado neste checkout. `.env.example` documenta nomes, não valores reais; os segredos e configurações definidos na Vercel/Neon não são verificáveis por leitura do código. Confirmar `AUTH_SECRET`, `INVOICE_INGEST_API_KEY`, `DATABASE_URL` e permissões de acesso diretamente no processo de deploy autorizado, sem compartilhamento de valores.
- **Isolamento multi-tenant futuro:** `Invoice` (`prisma/schema.prisma:213` em diante) não tem campo explícito de tenant; hoje o escopo das notas usa papéis, vínculo com fornecedor e tarefas de workflow (por exemplo, `src/lib/invoice-query.ts:28-38`). A tabela `Company` existente é usada para associação de dados de NSU, não constitui por si só um limite geral de tenant para notas. Isso não prova vazamento entre clientes na arquitetura atual, mas significa que onboarding de clientes em uma base compartilhada requer decisão e implementação explícita de tenant antes de usar CNPJ/empresa como substituto do isolamento.
- **Outros controles operacionais:** não foram inspecionados limites de taxa, firewall/WAF, CORS aplicado na borda, políticas de backup, rotação de credenciais ou regras de rede do Neon. Não há evidência suficiente neste checkout para declarar falha nesses controles.

## Priorização consolidada

1. **P0:** atualizar a dependência Next.js afetada pelo advisory crítico e confirmar os pré-requisitos de exploração do runtime.
2. **P1:** proteger `GET /api/notas` com sessão e escopo por usuário; revisar exposição histórica.
3. **P1:** tornar a autenticação de ingestão obrigatória quando não houver sessão e validar configuração de produção.
4. **P1:** remover o segredo de sessão padrão e confirmar configuração/rotação segura de `AUTH_SECRET`.
5. **Antes do multi-tenant:** definir tenant como limite de autorização em dados, consultas, exports, workflows, robôs e migrações; validar com casos de acesso cruzado.

## Limites e método

Auditoria estática read-only de arquivos rastreados e configuração de exemplo. Foram revisados os handlers de API, autenticação, autorização de notas/workflows, configurações e dependências declaradas. Não houve execução de testes, requisições contra ambiente, leitura de `.env`/`.env.local`, acesso ao banco, Vercel ou Neon, análise de histórico Git nem verificação automatizada de CVEs em todas as dependências transitivas. O inventário de dependências identifica o risco comprovado do Next.js; as demais dependências precisam de uma varredura de advisories no fluxo autorizado de atualização.
