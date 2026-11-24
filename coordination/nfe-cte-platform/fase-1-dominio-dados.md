# Fase 1 — Domínio, dados e parsing

**Estado:** planejada. **Dependência:** [Fase 0](f0-consolidado.md).

## Objetivo e escopo

Preparar uma estrutura central de documentos com detalhes por tipo, preservando NFS-e existente, XML original, dados fiscais e histórico. Modelar versões, empresa, relações CT-e/NF-e e ciclos de aprovação; detectar e interpretar os layouts de XML suportados. O recebimento público e a interface são entregues nas fases seguintes.

## Trabalho

1. Conferir schema, consumidores e migrações atuais; documentar campos centrais e os detalhes específicos de cada tipo, precisão decimal e índices. Considerar o detalhe NFS-e existente antes de migrá-lo.
2. Criar migration aditiva e estratégia de preenchimento verificável para NFS-e; preservar campos e APIs legados na transição. Registros sem tipo e sem evidência suficiente devem permanecer para análise, sem classificação presumida.
3. Modelar identidade, vínculo com empresa e fornecedor, XML por versão, conflito e histórico; impor unicidade concorrente e preservar documento anterior. Modelar referências ausentes e substituição de CT-e em qualquer ordem de chegada.
4. Permitir ciclos históricos e no máximo um ativo, mantendo versão de documento e configuração associadas. Comandos de ciclos antigos não podem avançar o atual.
5. Implementar identificação e parsing de NF-e/CT-e para os layouts confirmados e preservar os parsers NFS-e. Mapear tomador do CT-e, destinatário da NF-e, valores, itens, carga e referências sem inventar campos ausentes.

## Critérios de aceite

- Dados históricos NFS-e, XML e aprovações permanecem consultáveis após migração e preenchimento; divergências e registros sem evidência são reportados.
- Os três tipos podem ser representados com dados comuns e detalhe próprio; ausência de valor não vira zero, e `vNF`/`vTPrest` mantêm seu significado.
- Identidade única, versões, conflitos e relações suportam concorrência e preservam histórico; um substituto impede avanço do original e referências ausentes não criam nota fictícia.
- Situação cancelada, não autorizada ou desconhecida é representável como pendência; não inferir autorização sem evidência.

## Verificação e riscos

Verificar schema/migration em banco isolado com dados representativos e conferência de contagens, vínculos e histórico; exercitar parsers com os exemplos disponíveis e casos incompletos, concorrência e ambas as ordens de substituição. Não resetar banco populado. Layouts fiscais além dos exemplos exigem evidência antes de ativação. Aplicar a regra confirmada de elegibilidade: empresa ativa como destinatária NF-e ou tomadora CT-e; vínculo ausente/ambíguo e situação fiscal desconhecida permanecem pendentes. Registrar resultados e exceções; validação local não comprova produção.
