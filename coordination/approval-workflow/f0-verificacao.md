# F0 — Verificação inicial do workflow NFS-e

Checkout observado: `3f42588`. Verificação estática; não representa validação do ambiente de produção.

## Pontos de integração confirmados

| Área | Código | Impacto |
|---|---|---|
| Entrada | `src/app/api/notas/create-invoice.ts` | Cria a nota e registra histórico/auditoria em operações separadas. A entrada no workflow deve evitar duplicação e preservar a revisão administrativa prévia. |
| Atualização/aprovação | `src/app/api/notas/[id]/route.ts` | Aprovação exige avaliação, OC ou contrato e data de pagamento; altera status e processamento. Essa rota e a atualização por integração precisam respeitar a execução ativa. |
| Comunicação administrativa | `src/app/api/notas/[id]/comunicacao/route.ts` | Pode mudar status e processamento; precisa da mesma proteção contra avanço indevido. |
| Revisão administrativa | `src/app/api/notas/[id]/revisao/route.ts` | Liberação tem auditoria transacional; deve iniciar a atribuição operacional apenas uma vez quando a política de entrada estiver definida. |
| Consulta | `src/lib/invoice-query.ts`, `src/lib/auth.ts` | Escopo atual depende de fornecedor. A atribuição precisa permitir acesso à nota mesmo sem esse vínculo. |
| Formulários | `src/app/dashboard/page.tsx`, `src/app/notas/[id]/page.tsx` | Ambos coletam avaliação, pagamento, OC, contrato e parcelas na aprovação atual; devem consumir política comum de etapa. |
| Notificações | `src/lib/email.ts`, `src/app/api/notas/lembretes/route.ts` | O envio via Graph pode ser simulado; lembretes usam gestores do fornecedor. Atribuições exigem persistência e rastreamento próprios. |

## Decisões e pendências

- Confirmado: NFS-e primeiro; estrutura por tipo; etapas sequenciais com gestor fixo; campos configuráveis; primeira atribuição e alterações de responsável geram e-mail; auditoria; seleção de notas existentes; avaliação na etapa do gestor; OC ou contrato e data de pagamento obrigatórios em uma etapa.
- Confirmado: o alcance de consulta é configurável no workflow; somente ADMIN seleciona e envia notas existentes. Modos concretos de consulta ainda precisam de detalhamento.
- Persistem questões de elegibilidade de notas existentes, tratamento de responsável inativo, ações atuais de recusa/reabertura e acionamento operacional das tentativas de e-mail. Não presumir suas respostas ao alterar comportamento dependente.
- Exemplo de fluxo para validação: etapa 1 com avaliação do gestor; etapa 2 com OC ou contrato e data de pagamento preenchidos pelo responsável configurado; somente a conclusão da etapa 2 libera processamento.

## Evidências e limite

Inspecionados os arquivos de integração e os contratos existentes por busca estática. Nenhum código, schema, banco ou serviço externo foi alterado. Nenhum teste de aplicação foi executado nesta etapa.
