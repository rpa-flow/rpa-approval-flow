# Fase 4 — Verificação e ativação

**Estado:** planejada. **Dependência:** [Fases 1](fase-1-dominio-dados.md), [2](fase-2-api.md) e [3](fase-3-portal-workflow.md).

## Objetivo e escopo

Conferir a entrega contra a Fase 0 e preparar ativação gradual com evidências, responsáveis e recuperação. A homologação do consumidor externo e lançamento em outro sistema não integram este plano.

## Trabalho e critérios de aceite

1. Revisar cada regra e cenário aplicável da especificação consolidada, identificando evidência ou pendência explícita. Conferir exemplos de NFS-e, NF-e e CT-e e layouts suportados.
2. Verificar recepção, autenticação, duplicidade concorrente, versões corrigidas, revisão administrativa, empresa não resolvida, situações fiscais e substituição nas duas ordens de chegada.
3. Verificar workflow por tipo, troca de versão, reaprovação, recusas, histórico e autorização em lista, detalhe, XML, exportações e relações. Revalidar NFS-e e consumidores existentes.
4. Validar migration aditiva e preenchimento em ambiente isolado representativo, com contagens, amostras e exceções; executar build e verificações focadas aplicáveis. Documentar o que não foi possível verificar.
5. Preparar ativação gradual por tipo, pré-requisitos da chave, observação de erros/pendências e suspensão segura de novos recebimentos. Registrar responsável operacional, compatibilidade e plano de recuperação sem excluir dados nem fazer reset de banco populado.

## Entrega e limites

Concluir somente com evidências proporcionais para cada requisito, registro de riscos e pendências, e decisão operacional de ativação. Aprovação e execução de implantação dependem de autorização apropriada. Uma verificação local, inclusive build, não comprova banco, consumidores ou operação em produção.
