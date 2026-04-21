# RPA Approval Flow (Node + Next.js + Neon)

Sistema com API + frontend para gestão e aprovação de NFSe com controle de acesso por gestor.

## O que está implementado

- Recebimento de NFSe via API (`POST /api/notas`) com parser de XML.
- Persistência de dados da nota (status, processamento, valores, prestador/tomador, XML original).
- Identificador de nota com 44 dígitos (`codigoIdentificador`).
- Regras de aviso globais e por fornecedor (recorrência + e-mails extras).
- Login de gestor via frontend (`/login`) com sessão por cookie HttpOnly.
- Aprovação de notas via frontend (`/dashboard`), com escopo de acesso:
  - gestor vê apenas notas do seu fornecedor;
  - gestor só aprova notas do seu fornecedor.

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
- `/dashboard`: aprovação de notas do fornecedor do gestor + edição de regras globais e recorrência do fornecedor.

## Setup

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

## Observação importante de usuários

Para login funcionar, os gestores precisam existir no banco com `email` e `senhaHash`.
Ao criar fornecedor via `POST /api/fornecedores`, cada gestor já pode ser criado com senha (`senha`) no payload.
