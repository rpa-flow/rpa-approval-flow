# Detalhamento de retenções

A consulta autenticada GET /api/notas/[id] acrescenta retentionDetails com items (label e amount decimal em string) e status complete, partial ou unavailable. A autorização da nota permanece a mesma. O XML não é enviado ao navegador para montar o hint.

O detalhamento identifica os campos federais explícitos vRetIRRF, vRetCSLL, vRetINSS, vRetCP, vRetPIS e vRetCOFINS do layout nacional. Os valores vPis e vCofins são usados somente com tpRetPisCofins = 1 e quando não há valor explícito correspondente, evitando duplicação. Valores ausentes, inválidos ou não positivos não geram itens.

A soma é comparada em centavos com o total exibido. Divergências são sinalizadas como composição não confirmada. Layout ABRASF, ISS e demais campos sem mapeamento confirmado não são inferidos; a interface indica detalhamento indisponível ou composição parcial, conforme os itens identificados. Não há recálculo ou gravação de valores no banco.

O controle Ver retenções usa details/summary, podendo ser aberto por mouse, toque ou teclado. Sem XML válido ou itens identificados, exibe uma mensagem de indisponibilidade.
