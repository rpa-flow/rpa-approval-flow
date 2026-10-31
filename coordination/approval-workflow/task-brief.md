# Brief: workflow de aprovação por tipo de documento

## Resultado esperado

Produzir uma especificação e um plano executável para aprovação sequencial de NFS-e, com configuração por tipo, responsáveis fixos, campos por etapa, e-mails e auditoria.

## Contexto mínimo

- Usuário/jornada: ADMIN configura; GESTOR executa sua etapa; integração processa a nota após a aprovação final.
- Problema atual: aprovação única baseada em vínculo com fornecedor, sem etapa e responsável atuais persistidos.
- Caminhos relevantes: `prisma/schema.prisma`, `src/lib/{auth,invoice-query,audit,email,validations}.ts`, `src/app/api/notas/`, `src/app/{dashboard,notas,configuracoes}/`.

## Escopo

- Incluído: planejamento de configuração por tipo, somente NFS-e operacional, versões, etapas sequenciais, gestor fixo configurável, política de campos existentes, auditoria e notificações persistentes.
- Fora de escopo: implementação nesta solicitação, CT-e/produto operacionais, ramificações, aprovações paralelas, campos personalizados, novo processo de recusa/devolução.

## Critérios de aceite

1. Plano com fases, dependências, arquivos afetados e evidências de conclusão.
2. Regras confirmadas separadas de recomendações e decisões pendentes.
3. Cenários cobrem concorrência, revisão administrativa, acesso do responsável, aprovação final e falhas de e-mail.

## Contratos e decisões

- API/tipos/dados: estrutura por tipo, versão imutável publicada, execução por nota, eventos e caixa de notificações pendentes.
- Permissões: ADMIN configura; conclusão autorizada ao responsável atual; política de acesso por atribuição ainda precisa de alinhamento.
- Estados de UI: rascunho, publicada, validação, carregamento, vazio, erro, conflito e sucesso.

## Divisão do trabalho

- Coordenador: descoberta, especificação e plano, responsável exclusivo pelos documentos.
- Arquiteto: revisão estática delimitada das fronteiras de autorização, transação, auditoria e integração; sem edição de arquivos.
- Schema, contratos e arquivos da aplicação: nenhuma alteração nesta entrega.

## Verificação e riscos

- Verificação desta entrega: revisão do plano contra as decisões da conversa e o código atual; `git diff --check`.
- Implementação futura: verificações focadas, concorrência em PostgreSQL isolado, lint e build; não existe script `npm test` configurado.
- Riscos: bypass por rotas antigas, campo obrigatório oculto, fornecedor versus atribuição, notas antigas, perda de auditoria em cascata e duplicação eventual no envio externo.
