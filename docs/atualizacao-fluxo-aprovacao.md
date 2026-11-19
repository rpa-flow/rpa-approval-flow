# Atualização no fluxo de aprovação de notas fiscais

## O que muda

### Configuração das aprovações

Administradores poderão configurar uma sequência de etapas para a aprovação de notas fiscais. Em cada etapa, será possível definir o responsável e quais informações ficam ocultas, somente para consulta ou disponíveis para edição.

A configuração fica no menu lateral, em **Configurações → Workflow de aprovação**. As regras de publicação validam os campos obrigatórios considerando todas as etapas, permitindo, por exemplo, que a data de pagamento seja exigida em uma etapa e a ordem de compra ou o contrato seja preenchido em outra.

As configurações publicadas são versionadas. Notas que já começaram uma aprovação continuam seguindo a versão que receberam.

### Aprovação pelos gestores

O dashboard passa a destacar a fila **Minhas aprovações**, com a quantidade de notas atribuídas ao usuário. Nessa fila, as tarefas mais antigas aparecem primeiro e o tempo de espera fica visível junto à nota.

O gestor pode iniciar a aprovação diretamente pela linha da nota ou pela tela de detalhes. Durante a aprovação, aparecem apenas os campos que podem ser editados naquela etapa. Na tela de detalhes, os campos somente para consulta continuam apresentados como texto.

Ao concluir uma etapa, a nota segue para o próximo responsável. A aprovação final exige os dados definidos para o processo, como avaliação do serviço, data de pagamento e ordem de compra ou contrato.

### Comunicação de status

Após a conclusão das etapas, administradores podem marcar a nota como processada e comunicar os responsáveis por e-mail. A tela permite selecionar gestores ou informar outros endereços, incluir uma mensagem e anexar uma imagem ao e-mail.

### Acompanhamento administrativo

Administradores podem consultar o andamento das aprovações e acompanhar avisos de atribuição. Também podem retomar uma aprovação que ficou sem responsável ativo e acompanhar notificações que precisem de nova tentativa.

## Disponibilidade

Estas mudanças estarão disponíveis após a aprovação do PR e a implantação da versão. A ativação do fluxo também depende da publicação da configuração pelos administradores.

## Observação

A mensagem de e-mail depende da configuração do serviço de envio da organização. A inclusão de uma imagem é opcional.

