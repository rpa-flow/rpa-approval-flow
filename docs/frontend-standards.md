# Front-end Standards

## Organização de telas
- Estrutura base: `Header > Contexto da página > Conteúdo principal > Ações`.
- Cada página deve ter objetivo único e CTA principal explícito.
- Informações secundárias devem ficar em blocos colapsáveis ou áreas de apoio.

## Hierarquia visual
- 1 título principal por tela.
- Subtítulos para seções funcionais.
- Metadados com baixo contraste e tamanho reduzido.
- Evitar mais de 2 níveis de destaque por seção.

## Ações primárias e secundárias
- Primária: sempre destacada em `brand`.
- Secundária: neutra, sem competir com CTA principal.
- Ações destrutivas: `danger` + confirmação quando houver risco.

## Estados vazios
- Mensagem curta: o que aconteceu + próximo passo.
- Deve conter ação sugerida (ex.: “Criar fornecedor”).
- Nunca deixar área vazia sem orientação.

## Feedbacks
- Sucesso: confirmação objetiva.
- Erro: causa provável + ação corretiva.
- Loading: indicador não intrusivo, sem “pular layout”.

## Navegação
- Menu principal com no máximo 5 entradas de alto nível.
- Destaque da rota ativa sempre visível.
- Evitar múltiplos padrões de navegação na mesma jornada.

## Responsividade
- Mobile-first.
- Breakpoints padronizados do Tailwind.
- Tabelas devem adaptar com scroll horizontal ou card layout.

## Redução de poluição visual
- Espaço em branco é requisito, não desperdício.
- Evitar blocos com bordas em cascata.
- Limitar cores de destaque simultâneas a 2.
