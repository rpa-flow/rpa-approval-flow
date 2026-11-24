# Fase 3 — Portal e workflow por tipo

**Estado:** planejada. **Dependências:** [Fase 1](fase-1-dominio-dados.md) e [Fase 2](fase-2-api.md).

## Objetivo e escopo

Exibir e aprovar os três tipos no portal, com configuração, catálogo e versão de workflow por tipo, revisão administrativa e acesso consistente.

## Trabalho

1. Apresentar na lista tipo, número/chave, fornecedor, empresa, emissão, valor de referência, situação fiscal informada e estado de revisão/workflow; incluir filtros por tipo e estados.
2. Apresentar no detalhe os campos atuais de NFS-e, itens e totais de NF-e, e partes, trajeto, carga, componentes e relações de CT-e; acesso ao XML e a documentos relacionados segue permissões próprias.
3. Permitir que ADMIN configure e publique workflow separado por tipo, com campos e exigências aplicáveis; preservar versões e execuções NFS-e. Documento novo elegível entra no workflow publicado; para NF-e, a empresa ativa deve corresponder ao destinatário do XML; para CT-e, ao tomador. Vínculo ausente/ambíguo ou outros bloqueios mantém o documento pendente. Estoque que aguardava configuração é selecionado e encaminhado por ADMIN.
4. Exibir pendências de empresa, situação fiscal e conflito de XML ao ADMIN. Versão corrigida aceita reinicia aprovação desde a primeira etapa na versão publicada mais recente, preservando histórico. ADMIN pode reabrir nota recusada conforme regras já aprovadas.
5. Exibir CT-e substituto e original na mesma visão com histórico; impedir avanço do original, inclusive se a relação for resolvida depois. Referência a NF-e não bloqueia CT-e e não concede acesso a ela.
6. Aplicar autorização coerente a lista, detalhe, XML, exportação, tarefas e relações; consulta global de workflow é restrita ao tipo. Revisar relatórios e demais superfícies existentes para evitar mistura indevida de valores.

## Critérios de aceite

- ADMIN configura workflows independentes e documentos seguem somente a versão publicada de seu tipo, com bloqueios de revisão e associação respeitados.
- Lista e detalhe exibem os dados aprovados com estados de carregamento, erro e ausência acessíveis em telas móveis e desktop.
- Correção aceita reinicia o ciclo, preserva decisões anteriores e bloqueia comandos antigos; sem configuração publicada aguarda ADMIN.
- Substituição, relacionamentos, histórico e permissões permanecem corretos para os diferentes perfis e ordens de chegada.

## Verificação e riscos

Verificar jornadas de ADMIN, gestor e fornecedor, inclusive acesso direto por API, XML, exportação e vínculos; revisar fluxos e acessibilidade em tela pequena e desktop. Verificar NFS-e em andamento e publicação de nova versão. Não interpretar autorização informada no XML como consulta fiscal atual.
