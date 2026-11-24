# Fase 2 — API de recebimento

**Estado:** planejada. **Dependência:** [Fase 1](fase-1-dominio-dados.md).

## Objetivo e escopo

Receber NFS-e, NF-e e CT-e no contrato de entrada existente, identificar o XML e persistir documentos e pendências com segurança. O consumidor externo e sua implementação estão fora do escopo.

## Trabalho

1. Manter `POST /api/notas`, JSON com `xml` e multipart com `xmlFile`, e comportamento de criação manual NFS-e existente; detectar o tipo pelo XML. Conferir limites, erros e consumidores antes de mudar respostas.
2. Exigir chave de integração configurada e válida para chamadas sem sessão nos três tipos; manter acesso por sessão ADMIN/FORNECEDOR conforme autorização existente. Não ler ou registrar segredos.
3. Criar documento e efeitos associados de forma consistente: fornecedor por CNPJ e dados suficientes, empresa por destinatário NF-e ou tomador CT-e, revisão por valor/data e situação fiscal. Associação não resolvida ou situação fiscal pendente impede aprovação.
4. Tratar reenvio equivalente sem duplicar nota, tarefa ou notificação; XML diferente com mesma identidade gera conflito e versão candidata sem sobrescrever. Proposta da Fase 0: 200 para equivalente e 409 para conflito; avaliar compatibilidade do 409 atual de NFS-e antes de ativar a mudança.
5. Manter 400 para XML malformado/tipo desconhecido e 201 na criação. Persistir documento interpretável com situação pendente; limitar exposição de XML e dados nas respostas conforme autorização.

## Critérios de aceite

- Os três tipos são recebidos pelos formatos previstos, com identificação, associação e XML preservado; tipos novos não entram por cadastro manual.
- Sem sessão, chave ausente, incorreta ou não configurada não autoriza recepção; perfis com sessão continuam sujeitos às regras de acesso.
- Reenvio e conflito permanecem corretos sob concorrência, inclusive sem efeitos duplicados; falhas de parsing são compreensíveis e não criam nota elegível.
- Valor zero/data anterior e situação fiscal pendente são encaminhados à revisão, sem confundir campo ausente com zero.

## Verificação e riscos

Verificar contrato JSON/multipart, códigos e autorização com chave válida/inválida/ausente e sessões por perfil; executar cenários de conflito e concorrência e regressão NFS-e. Avaliar consumidores existentes antes de mudar duplicatas ou obrigatoriedade da chave: a implementação atual permite acesso sem sessão quando a chave não está configurada. Limites de layouts e situações fiscais não conhecidos devem permanecer bloqueados para aprovação.
