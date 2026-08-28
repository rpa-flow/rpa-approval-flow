# Multi-agent workflow

Estas regras valem para todo o repositório. O agente principal é o coordenador e deve usar especialistas apenas quando o ganho superar o custo de contexto.

## Fontes de verdade

Leia somente o necessário para a tarefa:

- Produto e operação: `README.md` e documentação específica em `docs/`.
- Arquitetura: `docs/architecture-guidelines.md` e `docs/ai-guidelines.md`.
- Frontend: `docs/frontend-standards.md`, `docs/component-patterns.md` e `docs/design-system.md`.
- Visual: `design.md`.
- Banco e contratos: `prisma/schema.prisma`, `src/lib/validations.ts` e rotas afetadas.

Não carregue todos esses arquivos por padrão. Pesquise primeiro com `rg` e abra apenas os trechos relevantes.

Stack principal: Next.js 14 App Router, React 18, TypeScript, Prisma/Neon, Tailwind e Vercel. Trate arquivos/scripts Vite como legado até a tarefa confirmar o contrário.

## Papéis disponíveis

As instruções específicas ficam em `.agents/`:

- `pm.md`: escopo, critérios de aceite e prioridade.
- `architect.md`: contratos, limites e decisões estruturais.
- `designer.md`: fluxo, hierarquia, acessibilidade e design system.
- `backend.md`: API, domínio, Prisma, segurança e integrações.
- `frontend.md`: páginas, componentes, estado e responsividade.
- `qa.md`: riscos, testes e evidências de aceite.

Ao delegar, indique explicitamente o arquivo do papel que o agente deve ler. Um agente recebe um objetivo delimitado, arquivos/área em escopo e a saída esperada. Evite dois agentes editando o mesmo arquivo.

Use `.agents/templates/task-brief.md` para trabalho que cruza papéis. O brief é contexto compartilhado, não diário de execução. Arquivos como `prisma/schema.prisma`, contratos/tipos compartilhados, layouts e `package.json` devem ter um único responsável por vez.

## Estratégia econômica

1. Para correções pequenas e localizadas, trabalhe com um único agente.
2. Use PM quando o requisito estiver ambíguo ou envolver várias jornadas.
3. Use arquiteto apenas para contratos, dados, segurança, integrações ou mudanças transversais.
4. Use designer somente quando houver impacto perceptível na interface ou jornada.
5. Separe backend e frontend quando puderem trabalhar com um contrato estável e em arquivos distintos.
6. Use QA após existir algo verificável; antecipe QA apenas em alterações de alto risco.
7. Limite o paralelismo ao menor conjunto independente. Prefira no máximo 3 especialistas simultâneos.
8. Não delegue leitura genérica do repositório. Forneça contexto já descoberto e caminhos relevantes.

## Fluxo padrão

1. **Descobrir:** localizar código e restrições existentes.
2. **Definir:** registrar objetivo, fora de escopo e critérios de aceite. Em tarefas simples, faça isso em poucas linhas no próprio trabalho.
3. **Contratar:** alinhar payloads, tipos e estados antes de separar backend/frontend.
4. **Implementar:** mudanças pequenas, coesas e sem refatoração lateral.
5. **Verificar:** executar primeiro testes focados; depois lint/build conforme risco.
6. **Entregar:** resumir resultado, arquivos alterados, verificações e riscos restantes.

## Handoff obrigatório

Todo especialista deve retornar, de forma concisa:

```text
Resultado: <1-3 frases>
Arquivos: <caminhos alterados ou consultados>
Decisões: <somente as não óbvias>
Verificação: <comandos e resultado>
Pendências/riscos: <ou "nenhum">
```

Não repita o enunciado, não cole arquivos inteiros e não descreva cada comando executado.

## Guardrails comuns

- Preserve alterações existentes do usuário.
- Nunca leia, edite ou exponha `.env`/`.env.local`; use `.env.example` para conhecer nomes de configuração. Não registre dados sensíveis.
- Reutilize componentes, validações e serviços antes de criar novos.
- Mantenha compatibilidade com Next.js 14, Prisma e execução serverless na Vercel.
- Mudanças de schema exigem migration versionada e análise de compatibilidade.
- Mudanças de API exigem validação, autorização e tratamento de erros.
- Interface deve ser mobile-first, acessível e aderente ao design system.
- Não declare conclusão sem evidência proporcional ao risco.
- Não há script de testes configurado atualmente. Não prometa uma suíte inexistente: use verificações focadas disponíveis e `npm run build` quando proporcional ao risco, informando limitações.
