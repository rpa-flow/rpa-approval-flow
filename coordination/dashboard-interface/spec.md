# Dashboard: revisão de interface

## Objetivo

Refinar a central operacional de notas para melhorar leitura, responsividade e acessibilidade, preservando integralmente as regras e a identidade visual Corporate Precision.

## Escopo

Inclui composição da tela, filtros, tabela, mensagens de carregamento/erro/vazio e estados de controles. Exclui APIs, permissões, dados, regras de aprovação, rotas e tokens de cor.

## Decisões

- O conteúdo principal é a lista de notas; cabeçalho e filtros devem apoiá-la sem competir visualmente.
- Usar exclusivamente `ui-kit`, classes globais e tokens já definidos.
- Em telas estreitas, os controles devem fluir verticalmente e a tabela continuar acessível com rolagem horizontal explícita.
- Erro, vazio e carregamento devem ser estados semanticamente distintos, sem alterar o fluxo de busca.

## Critérios de aceite

1. A página tem um único título, contexto conciso e hierarquia clara entre ações, filtros e resultados.
2. Filtros avançados, contagem, exportação, limpar filtros e paginação continuam funcionais e responsivos.
3. Tabela, menus e modais mantêm as ações existentes, sem overflow acidental no viewport.
4. A busca exibe loading, erro e vazio de forma distinta, com semântica acessível e orientação de próximo passo quando não há resultados.
5. Todos os controles alterados conservam estados de foco, hover e disabled coerentes com o design system.

## Cenários

1. **Dado** um gestor no dashboard, **quando** lê a tela em desktop, **então** identifica contexto, filtros, ações e lista de notas em ordem de prioridade.
2. **Dado** uma tela móvel, **quando** o gestor ajusta filtros ou acessa uma nota, **então** controles não transbordam e a tabela continua navegável horizontalmente.
3. **Dado** uma busca em andamento, com falha ou sem resultados, **quando** a lista é atualizada, **então** o estado correspondente é anunciado e não se confunde com os demais.
4. **Dado** navegação por teclado, **quando** o gestor percorre controles alterados, **então** foco e rótulos permanecem visíveis e compreensíveis.
