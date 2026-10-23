# Resposta da consulta de uma nota

`GET /api/notas/:id` requer a mesma sessão e permissão de acesso à nota em todos os modos.

- Sem parâmetro: retorna apenas os campos utilizados na tela de detalhes e em suas ações, os dados exibidos do fornecedor, nomes dos gestores, descrição do serviço e detalhamento de retenções. IDs e e-mails dos gestores, campos internos de processamento/notificação e XML não são enviados.
- `?full=true`: retorna todos os campos escalares do registro Invoice, incluindo xmlOriginal, além do mesmo recorte de fornecedor/gestores anteriormente disponível e dos campos calculados. Não expande automaticamente histórico, notificações, avaliações ou outras relações.
- `?includeXml=true`: mantém o comportamento anterior de resposta completa com XML; equivale a full=true nessa consulta. Se um dos dois parâmetros for true, o modo completo prevalece. Outros valores não ativam o modo completo.

A tela usa a resposta enxuta sem precisar adicionar parâmetros. Integrações que dependam de campos removidos da resposta padrão devem usar full=true; consumidores já usando includeXml=true continuam compatíveis. A listagem de notas, o histórico e o PATCH não mudam neste ajuste.

A otimização reduz o JSON transferido ao navegador. A consulta ao banco ainda lê os dados necessários para autorização e o XML original para extrair descrição e retenções no servidor. Não há mudança de schema, persistência ou regras financeiras.
