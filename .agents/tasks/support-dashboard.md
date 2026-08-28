# Brief: painel interno de suporte

## Resultado esperado

ADMIN acessa `/suporte` diretamente e identifica falhas de download, vencimentos e degradação operacional; a rota não aparece no menu.

## Contexto mínimo

- Stack e regras: `AGENTS.md`.
- Dados: `Invoice.dataPagamento`, controles/tentativas NSU e checkpoints já existentes.
- Segurança: sessão via `getSessionManager()`; esconder a URL não substitui autorização.

## Escopo

- Incluído: página `/suporte`, API `/api/admin/suporte/dashboard`, métricas, gráfico, filas acionáveis e links para nota/empresa.
- Fora: reprocessamento, alertas automáticos, exportação, edição, migration e novas dependências.

## Critérios de aceite

1. Página e API funcionam somente para sessão `ADMIN`; API responde 401/403 adequadamente.
2. Nenhum link para `/suporte` é adicionado à navegação.
3. Histórico de `RetryError` dos últimos 30 dias aparece por dia, inclusive dias sem erro.
4. Erros atuais mostram empresa, NSU, tentativas, HTTP, mensagem e acesso ao diagnóstico.
5. Notas vencidas e com vencimento em até 7 dias são ordenadas por urgência e ligam ao detalhe.
6. `PROCESSADO`, `RECUSADO`, `EXPIRADA` e notas canceladas não aparecem em vencimentos.
7. A tela apresenta data de atualização, vazios e falha de carregamento de modo explícito.

## Contrato e decisões

- Defaults fixos no MVP: `periodDays=30`, `dueDays=7`; API aceita limites 7..90 e 1..30.
- Erro histórico: `NfseNsuAttempt.resultStatus=RetryError`; erro atual: `NfseNsuControl.status=RetryError`.
- Datas de vencimento são comparadas pelo início do dia em `America/Sao_Paulo`.
- Endpoint único; sem XML, access key ou dado sensível.
- Resposta: `generatedAt`, `filters`, `download`, `due`, `health`, conforme tipo exportado pelo backend.

## Divisão do trabalho

- Backend → `src/lib/support-dashboard.ts`, `src/app/api/admin/suporte/dashboard/route.ts`.
- Frontend → `src/app/suporte/**`; pode importar apenas o tipo do backend.
- Arquivos compartilhados não devem ser alterados.

## Verificação e riscos

- Verificar 401/403, buckets zerados, limites de listas, vencimento hoje e serialização de Decimal/BigInt.
- Executar `npm run build`; não há runner de testes configurado.

