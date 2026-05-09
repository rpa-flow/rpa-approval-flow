# AI Guidelines (Codex/Claude/Lovable)

## Objetivo
Este documento define como IA deve propor, alterar e revisar código neste projeto para garantir consistência, qualidade e compatibilidade com Vercel.

## Regras mandatórias
1. Reutilizar antes de criar novo componente.
2. Separar regra de negócio de renderização.
3. Evitar dependências grandes sem justificativa de custo/benefício.
4. Preservar compatibilidade serverless (sem estado em memória de longa duração).
5. Manter mudanças pequenas, testáveis e com baixo acoplamento.

## Fluxo obrigatório para novas features
1. Entender contexto funcional e impacto técnico.
2. Validar se já existe componente/hook/serviço reutilizável.
3. Definir contrato (tipos, props, payloads) antes da implementação.
4. Implementar UI com tokens do Design System.
5. Implementar lógica em camadas (serviço/hook/componente).
6. Revisar responsividade, acessibilidade, performance e Vercel build.
7. Atualizar documentação relevante em `docs/`.

## Checklist pré-entrega (IA)
- Consistência visual com tokens oficiais.
- Responsividade mobile-first.
- Acessibilidade (label, foco, contraste, semântica).
- Sem duplicação evidente de lógica/estilo.
- Sem componente “gigante” (>200 linhas sem justificativa).
- Sem acoplamento direto UI -> Prisma/infra.
- Sem anti-padrões de performance (re-render desnecessário, bundle inchado).
- Sem dependência de processo persistente.

## Guardrails Vercel
- Preferir rendering eficiente e payloads pequenos.
- Otimizar tamanho de bundle e evitar libs pesadas para tarefas simples.
- Evitar operações bloqueantes longas em request.
- Garantir que endpoints sejam idempotentes quando possível.
- Validar impacto de build (tempo, cache, geração Prisma quando aplicável).

## O que evitar explicitamente
- UI “genérica de IA” com gradientes/efeitos excessivos.
- Misturar decisões de layout com regras de domínio complexas.
- Criar hooks multifunção com responsabilidade difusa.
- Introduzir abstrações sem uso real (overengineering).
