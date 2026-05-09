# Design System — RPA Approval Flow

## Objetivo
Estabelecer uma linguagem visual corporativa, previsível e reutilizável para evitar interfaces genéricas e inconsistentes em futuras gerações por IA.

## Princípios visuais
- Clareza antes de ornamentação.
- Hierarquia explícita (título > subtítulo > corpo > metadado).
- Baixa densidade visual em telas operacionais.
- Cores com função semântica (não decorativa).
- Consistência de espaçamento e raio para reduzir ruído.

## Tokens oficiais
> Fonte de verdade: `tailwind.config.ts` e `src/app/globals.css`.

### Cores
- `brand`: ações primárias e elementos de foco.
- `success`: confirmação de sucesso.
- `warning`: atenção sem bloqueio.
- `danger`: erro, exclusão e bloqueio.
- `surface`/`background`: base de cards e páginas.
- `text`/`muted`: contraste principal e secundário.
- `border`: separadores e contornos discretos.

### Tipografia
- Família base: `Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`.
- Títulos: peso 600/700.
- Corpo: peso 400/500.
- Legendas/metadados: 12–13px com contraste `muted`.
- Evitar mais de 4 tamanhos de fonte por tela.

### Espaçamento (escala 4px)
- `1 = 4px`, `2 = 8px`, `3 = 12px`, `4 = 16px`, `6 = 24px`, `8 = 32px`, `10 = 40px`.
- Distância vertical entre seções: mínimo `24px`.
- Não usar margens arbitrárias fora da escala.

### Bordas e sombras
- Raio padrão de componentes: `10px`.
- Raio de containers/card: `16px`.
- Borda padrão: `1px solid border`.
- Sombra somente em superfícies elevadas (cards, modais), sempre suave.

### Estados
- Hover: alteração sutil de fundo/contraste.
- Focus: anel visível (`focus ring`) com cor `brand` e contraste AA.
- Disabled: opacidade reduzida + cursor bloqueado.
- Loading: manter layout estável, usar skeleton/spinner discreto.

## Padrões por tipo de componente

### Botões
- Primário: ação principal única por contexto.
- Secundário: ações alternativas, baixa ênfase.
- Perigo: somente operações destrutivas.
- Não renderizar 3+ botões primários no mesmo bloco.

### Formulários
- Label sempre visível (não depender de placeholder).
- Mensagens de erro abaixo do campo, com texto objetivo.
- Agrupar campos por contexto de negócio.
- Máximo de 2 colunas em desktop; 1 coluna em mobile.

### Tabelas
- Cabeçalhos curtos e semânticos.
- Ações no fim da linha com prioridade visual clara.
- Evitar mais de 7 colunas sem estratégia responsiva.
- Estado vazio deve orientar próximo passo.

### Dashboards
- Cards KPI no topo, detalhes em blocos abaixo.
- Gráficos/tendências devem ter legenda textual.
- Evitar múltiplos destaques concorrendo por atenção.

### Modais
- Usar para tarefas focadas e curtas.
- Largura progressiva (`sm`, `md`, `lg`) com conteúdo rolável.
- Botão principal no canto inferior direito.
- Sempre oferecer saída clara (X + cancelar).

## Anti-padrões
- excesso de bordas e sombras;
- paleta com muitas cores saturadas;
- blocos sem alinhamento vertical consistente;
- textos longos em botões;
- componentes “all-in-one” com lógica + UI + chamadas API misturadas.
