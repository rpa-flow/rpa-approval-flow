# Design System — Corporate Precision

Fonte de verdade: [`design.md`](../design.md), `tailwind.config.ts` e `src/app/globals.css`.

Este sistema visual foi aplicado ao RPA Approval Flow para aproximar a interface da identidade da Minas Mineração: produtividade, confiança e precisão técnica em fluxos de aprovação.

## Tokens principais
- Primário: `#2b3a7e`, usado em ações principais, navegação ativa e foco.
- Secundário: `#23a18e`, usado como acento de confirmação e modernidade.
- Superfícies: base clara `#f8f9ff`, containers azulados suaves e cards brancos.
- Texto: `#191c20` para leitura principal e `#43474e` para metadados.
- Bordas: `#c3c7cf` para separação discreta.

## Tipografia
- Família base: `Manrope, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`.
- Títulos operacionais: 22–32px, peso 600.
- Corpo e tabelas: 14px, peso 400/500.
- Labels e metadados: 12–14px, peso 500/600.

## Componentes
- Cards usam fundo branco, raio de 4px e sombra discreta.
- Botões primários usam azul institucional; ações secundárias usam teal ou outline conforme contexto.
- Badges usam cores semânticas com baixa saturação.
- Tabelas priorizam contraste, cabeçalhos curtos e linhas com hover sutil.
- Estados vazios, erros e loading mantêm layout estável com bordas e superfícies leves.

## Diretrizes
- Evitar gradientes decorativos, excesso de sombras e cantos muito arredondados.
- Usar a escala de espaçamento baseada em 4px.
- Manter telas operacionais densas, escaneáveis e sem aparência de landing page.
- Preferir componentes compartilhados em `src/components/ui` e `src/components/ui-kit`.
