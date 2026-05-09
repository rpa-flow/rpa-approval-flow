# Architecture Guidelines (Vite/React + Next API + Vercel)

## Estrutura recomendada
- `src/app`: páginas e rotas API (framework).
- `src/app/components`: componentes compartilhados de layout/UI.
- `src/lib`: serviços, auth, utilitários, integrações.
- `docs`: contexto de engenharia para IA e equipe.

## Separação de responsabilidades
- Página: orquestra dados e composição de seções.
- Componente: renderização e interação local.
- Hook: estado derivado e comportamento reutilizável.
- Serviço/lib: regras de integração e domínio reutilizáveis.

## Estratégia de estados
- Estado local por padrão.
- Elevar estado apenas quando necessário para coordenação.
- Evitar “global store” precoce; introduzir somente com dor real.

## Estratégia de API
- Padronizar respostas e erros.
- Validar payload antes da regra de negócio.
- Isolar acesso ao Prisma em funções de domínio reutilizáveis quando crescer.

## Escalabilidade
- Modularizar por domínio funcional (notas, fornecedores, configurações).
- Evitar acoplamento cruzado entre módulos.
- Documentar decisões arquiteturais relevantes em `docs/`.

## Compatibilidade Vercel
- Sem dependência de processos persistentes.
- Evitar tarefas longas síncronas em request.
- Priorizar rotas enxutas e previsíveis para reduzir cold start.
