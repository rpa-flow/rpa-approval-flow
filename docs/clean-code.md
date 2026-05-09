# Clean Code & SOLID no Front-end

## SOLID aplicado
- **S**: componente/hook com uma responsabilidade.
- **O**: estender comportamento via composição, não alteração extensa.
- **L**: contratos de props e tipos previsíveis.
- **I**: interfaces pequenas e específicas por contexto.
- **D**: depender de abstrações (serviços/utilitários), não de detalhes de infraestrutura.

## Regras práticas
- Nomes orientados a domínio (`ApprovalStatusBadge`, não `BlueTag`).
- Funções pequenas, com intenção clara.
- Early return para reduzir aninhamento.
- Extrair constantes mágicas.
- Centralizar validações em utilitários.

## Limites de complexidade recomendados
- Componente de UI: até ~200 linhas (alvo: <120).
- Hook custom: até ~150 linhas com foco único.
- Arquivo de serviço: funções coesas por domínio.

## Code smells para refatorar
- `useEffect` com múltiplas responsabilidades.
- Props drilling excessivo sem necessidade.
- JSX com lógica condicional complexa inline.
- Duplicação de classes Tailwind em muitos pontos.
