# RPA Approval Flow (Node + Next.js + Neon)

Sistema com API + frontend para gestão e aprovação de NFSe com controle de acesso por gestor.

## O que está implementado

- Recebimento de NFSe via API (`POST /api/notas`) com parser de XML.
- Um gestor pode estar vinculado a múltiplos fornecedores, com escopo respeitado em listagem/aprovação/configurações.
- Persistência de dados da nota (status, processamento, valores, prestador/tomador, XML original).
- Identificador de nota com 44 dígitos (`codigoIdentificador`).
- Status da nota: `AGUARDANDO_APROVACAO`, `APROVADO`, `PROCESSADO`, `EXPIRADA`.
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

### Notas
- `GET /api/notas` (integração geral)
- `POST /api/notas` (pode ser protegido por `x-api-key` via `INVOICE_INGEST_API_KEY`)
- `PATCH /api/notas/:id` (requer login; valida acesso por fornecedor)
- `GET /api/notas/minhas` (requer login; retorna apenas notas permitidas)
- `GET /api/notas/lembretes` (lista notas pendentes de lembrete para job diário, opcionalmente protegido por `x-api-key`)
- `POST /api/notas/lembretes` (processa tentativas de lembrete; ao atingir `maxTentativas`, marca nota como `EXPIRADA`)
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

### Fornecedores
- `GET /api/fornecedores` (requer `ADMIN`)
- `POST /api/fornecedores` (requer `ADMIN`)
- `PATCH /api/fornecedores/:id` (requer `ADMIN`, edição de nome/CNPJ e vínculo de gestor)
- `GET /api/gestores` (requer `ADMIN`, lista gestores existentes para seleção)

## Frontend

- `/login`: autenticação do gestor.
- `/dashboard`: listagem profissional de notas com filtros (pendentes, concluídas, todas).
- `/configuracoes`: tela dedicada para regras globais e regras do fornecedor (recorrência + e-mails extras).
- `/fornecedores`: entrada da gestão de fornecedores.
  - para `ADMIN`, mostra tabela com fornecedores, ação de editar e botão "Adicionar novo fornecedor";
  - para `GESTOR`, mostra os fornecedores vinculados ao usuário em modo consulta.
- `/cadastros`: tela separada (somente `ADMIN`) para cadastro de fornecedores e gestores.

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

## SMTP recomendado para envio real

Opções simples para começar:

- **Brevo (Sendinblue)**: fácil para transacional e tem plano gratuito inicial.
- **Mailgun**: robusto para backend e automações.
- **SendGrid**: popular e bem documentado.
- **Amazon SES**: custo baixo em escala (setup um pouco mais técnico).

Exemplo de configuração (com Brevo/SendGrid/Mailgun via SMTP):

```env
SMTP_HOST="smtp.seu-provedor.com"
SMTP_PORT="587"
SMTP_USER="seu_usuario_smtp"
SMTP_PASS="sua_senha_ou_api_key_smtp"
SMTP_SECURE="false"
SMTP_FROM="notificacoes@suaempresa.com"
```

> Dica: em produção, prefira `SMTP_FROM` com domínio autenticado (SPF/DKIM) para melhorar entregabilidade.

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


## Migrations versionadas

O repositório agora inclui migration SQL versionada em `prisma/migrations/` para subir estrutura inicial do banco sem depender de geração local.


Notas de exemplo criadas pelo seed (todas vinculadas ao gestor `gestor.teste@empresa.com`): `NF-1001`, `NF-1002`, `NF-2001`, `NF-2002`.
