# RPA Approval Flow (Node + Next.js + Neon)

Sistema com API + frontend para gestão e aprovação de NFSe com controle de acesso por gestor.

## O que está implementado

- Recebimento de NFSe via API (`POST /api/notas`) com parser de XML.
- Um gestor pode estar vinculado a múltiplos fornecedores, com escopo respeitado em listagem/aprovação/configurações.
- Persistência de dados da nota (status, processamento, valores, prestador/tomador, XML original).
- Identificador de nota com 44 dígitos (`codigoIdentificador`).
- Status da nota: `AGUARDANDO_APROVACAO`, `APROVADO`, `PROCESSADO`.
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
- `POST /api/notas`
- `PATCH /api/notas/:id` (requer login; valida acesso por fornecedor)
- `GET /api/notas/minhas` (requer login; retorna apenas notas permitidas)
- `GET /api/notas/lembretes` (endpoint global para job diário de lembrete, opcionalmente protegido por `x-api-key`)

### Configurações
- Global:
  - `GET /api/configuracoes/avisos`
  - `PUT /api/configuracoes/avisos`
- Por fornecedor:
  - `GET /api/configuracoes/fornecedores/:supplierId/avisos`
  - `PUT /api/configuracoes/fornecedores/:supplierId/avisos`

### Notificações
- `POST /api/notificacoes/aprovacao` (requer login)

## Frontend

- `/login`: autenticação do gestor.
- `/dashboard`: listagem profissional de notas com filtros (pendentes, concluídas, todas).
- `/configuracoes`: tela dedicada para regras globais e regras do fornecedor (recorrência + e-mails extras).

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


## Migrations versionadas

O repositório agora inclui migration SQL versionada em `prisma/migrations/` para subir estrutura inicial do banco sem depender de geração local.
