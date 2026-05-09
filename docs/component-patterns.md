# Component Patterns

## Padrão base
- `Container Component`: coordena dados e estado de tela.
- `Presentational Component`: recebe props e renderiza UI pura.
- `Primitive UI`: botão, input, card, badge reutilizáveis.

## Convenções
- Um componente por arquivo.
- Nome de arquivo em kebab-case; componente em PascalCase.
- Props tipadas e documentadas.
- Sem acesso direto a API dentro de componentes puramente visuais.

## Reutilização
1. Procurar componente existente.
2. Se 80% compatível, estender por props/composição.
3. Criar novo somente quando houver novo comportamento de domínio.

## Estratégia para formulários
- Campos e validação desacoplados de layout.
- Mensagens de erro no mesmo padrão visual.
- Regras compartilhadas em utilitários.

## Estratégia para tabelas
- Configurar colunas por metadados quando possível.
- Extrair células complexas para subcomponentes.
- Ações de linha com ordem consistente (visualizar > editar > excluir).
