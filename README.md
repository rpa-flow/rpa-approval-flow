# RPA Approval Flow (Node + Next.js + Neon)

Sistema com API + frontend para gestão e aprovação de NFSe com controle de acesso por gestor.

## O que está implementado

- Recebimento de NFSe via API (`POST /api/notas`) com parser de XML.
- Um gestor pode estar vinculado a múltiplos fornecedores, com escopo respeitado em listagem/aprovação/configurações.
- Persistência de dados da nota (status, processamento, valores, prestador/tomador, XML original).
- Identificador de nota com 44 a 50 dígitos (`codigoIdentificador`).
- Status da nota: `AGUARDANDO_APROVACAO`, `APROVADO`, `RECUSADO`, `PROCESSADO`, `EXPIRADA`, `DADOS_INCONSISTENTES`.
- Regras de aviso globais e por fornecedor (recorrência + e-mails extras).
- Login de gestor via frontend (`/login`) com sessão por cookie HttpOnly.
- Aprovação de notas via frontend (`/dashboard`), com escopo de acesso:
  - gestor vê apenas notas dos fornecedores vinculados a ele;
  - gestor só aprova notas dos fornecedores vinculados a ele.

## Endpoints

### Autenticação
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/change-password` (requer login)

### Notas
- `GET /api/notas` (integração geral)
- `POST /api/notas` (pode ser protegido por `x-api-key` via `INVOICE_INGEST_API_KEY`)
- `POST /api/notas/recusadas` cria uma nota diretamente com status `RECUSADO`, marca o processamento como erro e não envia e-mail de notificação. Aceita o mesmo payload de criação de nota e os campos opcionais `reason` ou `observacaoValidacao`.
- `PATCH /api/notas/:id` (requer login; valida acesso por fornecedor)
  - `ADMIN` pode ajustar manualmente `tentativasNotificacao` e `ultimoLembreteEm`.
- `GET /api/notas/minhas` (requer login; retorna apenas notas permitidas)
- `GET /api/notas/lembretes` (lista notas com status `AGUARDANDO_APROVACAO` ou `DADOS_INCONSISTENTES` pendentes de lembrete para job diário, opcionalmente protegido por `x-api-key`)
  - use `?contabilizar=true` para registrar o envio do lembrete e enviar e-mail na mesma chamada.
  - use `&enviarEmail=false` se quiser contabilizar sem enviar e-mail.
- `POST /api/notas/lembretes` (processa lembretes recorrentes e envia e-mails enquanto a regra estiver ativa)
  - notas sem nenhum envio anterior (`tentativasNotificacao = 0`) entram como lembrete devido imediatamente.

### Configurações
- Global:
  - `GET /api/configuracoes/avisos`
  - `PUT /api/configuracoes/avisos`
- Por fornecedor:
  - `GET /api/configuracoes/fornecedores/:supplierId/avisos`
  - `PUT /api/configuracoes/fornecedores/:supplierId/avisos`

### Notificações
- `POST /api/notificacoes/aprovacao` (requer login)
- `POST /api/notificacoes/teste-email` (requer login; envia um e-mail simples para validar recebimento; `ADMIN` pode informar outro destinatário)

Payload opcional para teste de e-mail:

```json
{
  "destinatario": "seu.email@empresa.com",
  "assunto": "Teste de recebimento",
  "mensagem": "Mensagem enviada pela rota de teste do RPA Approval Flow."
}
```

### Fornecedores
- `GET /api/fornecedores` (requer `ADMIN`)
- `POST /api/fornecedores` (requer `ADMIN`)
- `PATCH /api/fornecedores/:id` (requer `ADMIN`, edição de nome/CNPJ e vínculo de gestor)
- `GET /api/gestores` (requer `ADMIN`, lista gestores existentes para seleção)

## Frontend

- `/login`: autenticação do gestor.
- `/dashboard`: listagem profissional de notas com filtros (pendentes, concluídas, todas).
- `/configuracoes`: tela dedicada para regras globais e regras do fornecedor (recorrência + e-mails extras, sem limite de quantidade de lembretes).
- `/perfil`: tela de perfil com alteração de senha do usuário logado.
- `/fornecedores`: entrada da gestão de fornecedores.
  - para `ADMIN`, mostra tabela com fornecedores, ação de editar e botão "Adicionar novo fornecedor";
  - para `GESTOR`, mostra os fornecedores vinculados ao usuário em modo consulta.
- `/cadastros`: tela separada (somente `ADMIN`) para cadastro de fornecedores e gestores.
- Header com menu rápido (Dashboard, Fornecedores, Configurações e Perfil) para navegação diária.

## Setup

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate -- --name init
# ou em ambiente já versionado (CI/prod):
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

## Deploy na Vercel (Prisma)

Este projeto já está configurado para rodar `prisma generate` durante o build (`npm run build` e `vercel-build`), evitando erro de `PrismaClientInitializationError` causado por cache de dependências da Vercel.

Garanta também as variáveis de ambiente em produção (`DATABASE_URL`, `AUTH_SECRET`, etc.).

## Microsoft Graph para envio real

O envio de e-mail usa Microsoft Graph API com fluxo OAuth2 Client Credentials.

Configure as variáveis abaixo (ou os aliases `GRAPH_*`):

```env
MS_GRAPH_TENANT_ID="seu-tenant-id"
MS_GRAPH_CLIENT_ID="seu-client-id"
MS_GRAPH_CLIENT_SECRET="seu-client-secret"
MS_GRAPH_SENDER_USER="rpa.minas@minasmineracao.com.br"
# aliases opcionais equivalentes:
# GRAPH_TENANT_ID="seu-tenant-id"
# GRAPH_CLIENT_ID="seu-client-id"
# GRAPH_CLIENT_SECRET="seu-client-secret"
# GRAPH_SENDER_USER="rpa.minas@minasmineracao.com.br"
APP_BASE_URL="https://rpa.suaempresa.com"
```

Permissões necessárias no App Registration (Application Permissions):

- `Mail.Send`

As quatro variáveis `MS_GRAPH_TENANT_ID`, `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET` e `MS_GRAPH_SENDER_USER` são obrigatórias para envio real. Se qualquer uma delas não for preenchida no ambiente em execução, o sistema entra em modo simulado e registra no log quais variáveis estão ausentes antes do envio (`[email:config]` e `[email:simulado]`).

## Observação importante de usuários

Para login funcionar, os gestores precisam existir no banco com `email` e `senhaHash`.
Ao criar fornecedor via `POST /api/fornecedores`, cada gestor já pode ser criado com senha (`senha`) no payload.


## Seed de usuário de teste

Execute:

```bash
npm run prisma:seed
```

Usuário criado/atualizado pelo seed:

- email: `gestor.teste@empresa.com`
- senha: `123456`
- role: `ADMIN`

Se em produção/login aparecer erro 500, valide:
- `DATABASE_URL` configurada na Vercel;
- se o banco possui usuário válido (`npm run prisma:seed` em ambiente de setup);
- se `senhaHash` dos gestores está no formato esperado (`salt:hash`).


## Migrations versionadas

O repositório agora inclui migration SQL versionada em `prisma/migrations/` para subir estrutura inicial do banco sem depender de geração local.


Notas de exemplo criadas pelo seed (todas vinculadas ao gestor `gestor.teste@empresa.com`): `NF-1001`, `NF-1002`, `NF-2001`, `NF-2002`.

## Governança para AI-assisted development

Para manter consistência arquitetural, visual e de qualidade, consulte sempre:

- `docs/ai-guidelines.md`
- `docs/frontend-standards.md`
- `docs/design-system.md`
- `docs/component-patterns.md`
- `docs/clean-code.md`
- `docs/architecture-guidelines.md`

Esses documentos são a base de decisões para evoluções com Codex/Claude/Lovable em ambiente Vercel.
