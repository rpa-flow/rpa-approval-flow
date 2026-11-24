# Brief: Plataforma de recebimento e aprovação NFS-e, NF-e e CT-e

## Resultado esperado

Receber documentos fiscais por API, preservar dados e histórico, tratar pendências e aprovar por workflows isolados por tipo, mantendo compatibilidade NFS-e.

## Contexto mínimo

- Usuário/jornada: ADMIN, gestores e fornecedores que consultam e aprovam documentos.
- Problema atual: domínio, parser e workflow atuais são orientados a NFS-e.
- Caminhos relevantes: `coordination/nfe-cte-platform/f0-consolidado.md`, fases 1–4, `prisma/schema.prisma`, `src/app/api/notas/**`, `src/lib/workflow/**`.

## Escopo

- Incluído: Fases 1–4 do plano, até preparar ativação gradual e documentar evidências/pendências.
- Fora de escopo: coleta FSist, lançamento Minerion/Delphi, mudanças no `rpa-web`, deploy, produção, homologação externa e habilitação operacional.

## Critérios de aceite

1. POST JSON/multipart recebe NFS-e, NF-e e CT-e com chave de integração obrigatória para chamadas sem sessão; permissões por sessão existentes continuam aplicadas. Cadastro manual continua apenas NFS-e.
2. Migration aditiva preserva registros, XML e aprovações NFS-e; identidade, versões e conflitos são seguros sob concorrência e sem sobrescrita silenciosa.
3. Parsing conserva semântica fiscal, ausência de valor e situação desconhecida; empresa/situação pendente impede aprovação.
4. Workflows e consulta global são isolados por tipo; ciclos históricos mantêm aprovações e comandos antigos não avançam o ciclo atual.
5. Referências CT-e/NF-e são informativas; substituição impede avanço do original nas duas ordens de chegada e não concede acesso ao relacionado.
6. Lista, detalhe, XML, exportação e tarefas aplicam permissões coerentes; portal apresenta campos e estados acessíveis para os três tipos.
7. Verificações focadas, build, revisão contra todos os critérios e relatório de evidências/limitações concluídos antes de declarar pronto. Ativação operacional não é parte autorizada.

## Contratos e decisões

- API/tipos/dados: F0 consolidado é a fonte de verdade. Preservar 409 de duplicata NFS-e até comprovar compatibilidade; resposta equivalente e conflito para tipos novos seguem F0.
- Permissões: sessão ADMIN/FORNECEDOR preserva regras existentes; chamada sem sessão exige chave configurada e válida. Tipos novos não alimentam consumidores/flags legados automaticamente.
- Estados de UI: incluir pendências fiscais, vínculo de empresa, conflito/versões, loading, vazio, erro e sucesso.

## Divisão do trabalho

- PM (`.agents/pm.md`): critérios e limites consolidados; concluído.
- Backend (`.agents/backend.md`): domínio, schema, migration, parsing, APIs e isolamento de consumidores; dono único dos arquivos compartilhados de contrato/schema.
- Frontend (`.agents/frontend.md`): levantamento em paralelo; implementação somente após DTO/estados do backend estabilizados, em páginas/componentes próprios.
- QA (`.agents/qa.md`): matriz e fixtures focadas em paralelo; revisão independente após integração, sem alterar implementação.
- Orquestrador: coordenar interfaces/etapas, resolver dependências e ser responsável pela decisão de aceite; migration e schema têm um único dono por vez.

## Verificação e riscos

- Comandos/cenários mínimos: testes focados disponíveis, validação da migration/schema em ambiente isolado se disponível, `npm run build`, autorização, idempotência, conflitos, workflow/permissões e regressão NFS-e.
- Riscos conhecidos: sem XMLs fiscais reais no checkout; layouts, consumidores externos e estado operacional não serão homologados. Sem reset de banco populado.
