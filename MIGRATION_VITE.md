# Migração de Stack: React + Vite + TypeScript + Tailwind

Este repositório era baseado em Next.js. Para atender a nova stack, foi criado um **bootstrap inicial** com:

- `index.html`
- `vite.config.ts`
- `src/main.tsx`
- `src/App.tsx`
- `tailwind.config.ts`
- `postcss.config.cjs`
- `src/styles/tailwind.css`

## Scripts
- `npm run vite:dev`
- `npm run vite:build`
- `npm run vite:preview`

## Próximas etapas recomendadas
1. Migrar páginas Next (`src/app/**`) para componentes React com React Router.
2. Substituir APIs Next (`src/app/api/**`) por backend dedicado (Express/Fastify/Nest) ou BFF.
3. Extrair autenticação para serviço separado e adaptar session handling.
4. Eliminar gradualmente dependências de Next quando a migração de telas/API estiver concluída.
