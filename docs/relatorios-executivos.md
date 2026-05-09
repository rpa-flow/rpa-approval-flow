# Relatórios Executivos

A rota `/relatorios` centraliza KPIs executivos e relatórios operacionais de notas fiscais.

## Endpoints
- `/api/relatorios/resumo`
- `/api/relatorios/notas-criadas-lancadas`
- `/api/relatorios/pendencias`
- `/api/relatorios/sla-aprovacao`
- `/api/relatorios/fornecedores`
- `/api/relatorios/avaliacoes`
- `/api/relatorios/riscos`
- `/api/relatorios/financeiro`
- `/api/relatorios/auditoria`

Todos os endpoints aplicam autenticação e escopo por perfil:
- `ADMIN`: visão global
- `GESTOR`/`FORNECEDOR`: apenas fornecedores vinculados

## Arquitetura
- Filtros e escopo ficam em `src/lib/reports.ts`.
- Cálculo/agregação no backend para evitar carga no frontend.
- Componentes reutilizáveis em `src/app/components/reports/report-components.tsx`.
