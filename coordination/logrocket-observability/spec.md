# LogRocket para diagnóstico de aprovação

## Objetivo e limites

- Objetivo: permitir inspecionar sessões da jornada de aprovação quando um usuário encontrar falhas, reduzindo ao mínimo os dados enviados ao LogRocket.
- Em escopo: integração client-side no Next.js 14, ativação por ambiente, sanitização de replay e rede, e delimitação de quem pode ser gravado.
- Fora de escopo: credenciais privadas do LogRocket no servidor, captura de corpos de notas, anexos/XML, dados de autenticação, identificação por e-mail/nome, ativação até o usuário configurar o ambiente e mudança de retenção na conta LogRocket.
- Aprovação: usuário autorizou gravar gestores e administradores e identificá-los pelo ID interno; integração implementada desligada por padrão.

## Fatos observados e decisões pendentes

| Tipo | Item | Evidência ou decisão necessária |
|---|---|---|
| Fato observado | O app usa Next.js 14 App Router; `src/app/layout.tsx` é um layout server e ainda não inicializa monitoramento de sessão. | `package.json`, `src/app/layout.tsx` |
| Fato observado | LogRocket não aparece nas dependências atuais nem há variáveis LogRocket em `.env.example`. | `package.json`, `.env.example` |
| Fato observado | O produto trata notas fiscais, CNPJ, fornecedores, valores, dados de pagamento, comentários e credenciais. | Telas de notas, dashboard, login e gestão |
| Fato observado | O SDK grava DOM, eventos, rede e console por padrão; senha é excluída automaticamente, mas outros inputs e textos não. Sanitização DOM e de rede são configurações independentes. | [dados coletados](https://docs.logrocket.com/docs/data-collected), [DOM](https://docs.logrocket.com/reference/dom), [rede](https://docs.logrocket.com/reference/network) |
| Recomendação | Ativar somente com `NEXT_PUBLIC_LOGROCKET_ENABLED=true` e `NEXT_PUBLIC_LOGROCKET_APP_ID` configurados no ambiente de produção. Padrão desativado; não registrar em dev ou previews. O App ID é identificador público do projeto, não segredo. | Confirmar ambiente e projeto LogRocket antes de ativar |
| Decisão do usuário | Gravar todo `ADMIN` e `GESTOR` autenticado quando habilitado em produção; excluir `FORNECEDOR` e visitantes não autenticados. | Validado no endpoint autenticado de observabilidade |
| Decisão do usuário | Identificar a sessão com o ID interno imutável do usuário, sem nome, e-mail ou traits adicionais. | Implementar somente `LogRocket.identify(userId)` |
| Implementado | Ativar `inputSanitizer`, `textSanitizer` e `imageSanitizer`, sem allowlist de conteúdo. | O replay mostra estrutura e interações sem valores de campos, textos, imagens ou dados fiscais |
| Recomendação | Sanitizar solicitações/respostas para remover cabeçalhos e corpos e remover query strings e IDs de URLs, mantendo método, status e duração. Desativar captura de console até existir uma política de logs sem dados pessoais. | Validar formato de rede aceito pelo SDK na implementação |
| Decisão pendente | Quem poderá consultar/exportar as gravações e qual retenção será configurada na conta LogRocket? | Definir responsáveis, retenção e auditoria no produto LogRocket |
| Configuração pendente | App ID do projeto e flag de produção. | Definir `NEXT_PUBLIC_LOGROCKET_APP_ID` e `NEXT_PUBLIC_LOGROCKET_ENABLED=true` no ambiente Production da Vercel |

## Domínio

- Atores: `ADMIN`/`GESTOR` gravados; equipe autorizada de suporte que consulta replay; `FORNECEDOR` não gravado pela proposta padrão.
- Ciclo: SDK permanece inativo por padrão; ambiente configurado e habilitado inicia uma sessão; autenticação/role e regras de sanitização delimitam a captura; desativar a flag interrompe novas gravações.

### Regras de domínio

- DR-1: Sem flag e App ID válidos no ambiente habilitado, o SDK não deve ser carregado nem iniciar sessão.
- DR-2: Sessões de `FORNECEDOR`, visitantes não autenticados e ambientes dev/preview não devem ser enviadas.
- DR-3: Valores digitados, textos dinâmicos de nota/fornecedor/empresa/usuário, imagens, tokens, cookies, cabeçalhos de autenticação e corpos de API não devem ser enviados ao LogRocket.
- DR-4: A captura deve manter apenas o contexto mínimo necessário para diagnosticar navegação, interação, erros de interface e status/tempo de chamadas, após remover valores identificadores das URLs.
- DR-5: Enviar somente o ID interno imutável ao identificar usuário; não enviar nome, e-mail ou traits; mensagens customizadas não podem conter conteúdo de nota.
- DR-6: Não ativar a integração em produção antes de confirmar projeto App ID, acesso à conta, retenção e público autorizado.

## Cenários de aceite

### AC-1: Integração desativada por padrão

**Dado** que a flag não existe ou está desativada

**Quando** uma página do app é carregada

**Então** o SDK não é importado/inicializado e nenhuma sessão é enviada.

### AC-2: Usuário fora do público permitido

**Dado** um visitante anônimo ou usuário `FORNECEDOR`

**Quando** navega no app com a integração habilitada para produção

**Então** nenhuma gravação é iniciada para essa sessão.

### AC-3: Sessão interna sanitizada

**Dado** um `ADMIN` ou `GESTOR` autorizado em produção

**Quando** usa a jornada de aprovação

**Então** replay preserva estrutura e interações, mas mascara inputs, textos e imagens; chamadas não incluem headers, corpos, query strings nem caminhos de API identificáveis.

### AC-4: Falha de chamada sem payload sensível

**Dado** que uma chamada de aprovação falha

**Quando** o replay é consultado

**Então** método, status e duração podem ser usados para diagnóstico, mas request/response body, headers e identificadores na URL não estão presentes.

### AC-5: Identificação mínima

**Dado** uma sessão gravada

**Quando** é enviada ao LogRocket

**Então** ela é associada somente ao ID interno imutável e não inclui nome, e-mail ou traits.

## Erros, autorização e limites

- A sanitização do DOM não substitui sanitização da rede; ambas precisam ser configuradas e validadas separadamente.
- Se a autenticação/role não puder ser determinada com segurança, não iniciar a gravação.
- Se a configuração de sanitização falhar ou estiver ausente, falhar fechado: não inicializar SDK.
- A integração client-side não pode ler nem transmitir segredos de `.env`; usar somente App ID público e flag pública.
- Configuração de conta LogRocket, controle de acesso, retenção, DPA e aviso de privacidade são controles externos e não ficam comprovados por um build local.

## Decisões técnicas

| Decisão | Abordagem proposta | Motivo | Consequência |
|---|---|---|---|
| Inicialização | Componente client-side dedicado no layout; import dinâmico do pacote após verificar ambiente, flag, App ID e role no endpoint autenticado. | O layout atual é server-side e LogRocket exige inicialização no browser. | Nova dependência client-side; nenhum dado do servidor é enviado. |
| Configuração | `NEXT_PUBLIC_LOGROCKET_ENABLED` e `NEXT_PUBLIC_LOGROCKET_APP_ID`; nenhuma credencial privada. | Mantém captura desativada por padrão e configura por ambiente. | Flag deve permanecer desligada em preview e em produção até validação. |
| DOM/rede | Sanitizadores globais e marcação explícita de áreas públicas/privadas na jornada coberta. | A aplicação lida com dados fiscais e financeiros; mascarar apenas senha é insuficiente. | Replay perde valores da nota; mantém navegação e erros estáticos selecionados. |
| Identidade | Usar `identify()` somente com ID interno imutável, após autenticação. | Permite localizar sessões sem transmitir nome ou e-mail. | O fornecedor recebe um identificador pseudônimo persistente. |

## Plano de implementação e verificação

1. Implementado bootstrap client-side desativado por padrão e limitado ao ambiente Production da Vercel.
2. Implementada autorização para `ADMIN`/`GESTOR` e identificação com somente o ID interno imutável.
3. Implementada sanitização de DOM, URLs, rede e console.
4. `npm run build` passou; permanece um warning de acessibilidade preexistente em `src/app/notas/[id]/page.tsx`.
5. Configurar App ID e flag no ambiente Production da Vercel; revisar gravação com dados fictícios antes de ativar.

## Riscos, rollout e adiamentos

- Risco principal: dados fiscais ou credenciais aparecerem em replay, rede, URL, console, atributos acessíveis ou texto dinâmico. A validação deve conferir o replay real, não apenas tipos/build.
- Rollout recomendado: revisar o replay de teste em projeto/conta autorizada; produção somente após revisão do replay e dos controles da conta. A implementação bloqueia preview/dev mesmo que a flag esteja definida.
- Retenção, DPA, aviso de privacidade, consentimento e responsáveis por acesso/exportação precisam ser decididos antes da ativação em produção.
- Não incluir anexos, XML, PDFs, upload, mensagens digitadas, console de dados ou identificação de usuário na primeira versão.
