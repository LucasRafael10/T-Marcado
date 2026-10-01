# Como o sistema funciona, passo a passo

## Aprovação manual (modo usado no Tá Marcado)

Com `ACCESS_APPROVAL_MODE=manual`, clientes e cerimonialistas escolhem a própria senha no cadastro e aguardam a equipe. A aprovação do administrador libera imediatamente a sessão de espera e o login com essa senha, sem e-mail ou link. A página de espera consulta o status a cada cinco segundos. A cerimonialista cria sua conta em `cadastro-cerimonialista.html`; ela não precisa cadastrar um evento.

Os passos de confirmação por e-mail abaixo se aplicam somente quando o modo é `email`.

## Cadastro do organizador

1. A pessoa preenche `public/index.html`, incluindo senha e confirmação.
2. `password-feedback.js` mostra a força estimada e se as senhas coincidem. Isso é ajuda visual; a validação do servidor continua obrigatória.
3. `main.js` envia os campos para `POST /api/register`.
4. `api.mjs` confere campos, datas, senha, confirmação e e-mail duplicado.
5. `repository.mjs` cria o usuário e o evento dentro de uma transação. `passwords.mjs` guarda o hash da senha, não a senha legível.
6. `loginCookie` cria uma sessão no navegador. Como `email_verified` ainda é falso, essa sessão não autoriza abrir os dados do evento.
7. `requestVerification` dispara o envio em segundo plano. O banco guarda somente o hash do token de confirmação.
8. O navegador abre `aguarde-confirmacao.html`. Não pede que a pessoa preencha o e-mail de novo.
9. Ao abrir o link no mesmo navegador, `confirm-verification.js` consulta o tipo de confirmação e envia o token para a API.
10. O servidor confirma o e-mail, preserva a senha do cadastro e invalida outras sessões da conta. O painel abre automaticamente. A aba de espera também detecta a confirmação.

**Por que o mesmo navegador?** O token do e-mail e a sessão do cadastro precisam apontar para a mesma conta. Isso evita ativar uma conta preparada por outra pessoa com uma senha conhecida por ela. Se o link abrir em outro navegador, copie o link original para o navegador do cadastro. Se perdeu a sessão, entre com a senha escolhida para retomar; recuperar a senha também continua possível.

O envio ser solicitado não significa que a mensagem chegou à caixa de entrada. Falhas de entrega são tratadas nos registros da Resend e do servidor. O botão de reenvio usa o e-mail da sessão e aguarda um minuto.

## Login e saída

`login.js` envia e-mail, senha e perfil. O servidor confere o hash e o perfil. Para conta confirmada, cria o cookie e libera o painel. Para conta não confirmada, prepara a sessão, solicita confirmação e abre a espera. Ao sair, `POST /api/logout` remove a sessão do banco e limpa o cookie.

O perfil interno `noiva` significa organizador. O nome foi mantido por compatibilidade e não limita o tipo do evento.

## Solicitação à cerimonialista

A cliente informa apenas o e-mail de uma conta existente de cerimonialista, no cadastro do evento (opcional) ou em “Sua cerimonialista” no painel. O servidor cria um pedido `pending` na tabela `planner_requests`, sem criar outra conta e sem inserir um acesso em `access`.

A cerimonialista entra com a própria senha e encontra “Solicitações de clientes”. Antes do aceite, vê somente nome/e-mail da cliente e título/tipo/data do evento. Apenas pedidos de clientes com conta liberada aparecem. O servidor verifica o perfil, a identidade destinatária, o evento e o ID da solicitação antes de registrar a resposta.

- Aceitar: a transação muda o pedido para `accepted` e cria o acesso de leitura em `access`. O evento aparece em “Seus eventos”, com convidados, confirmações e presentes.
- Recusar: o pedido fica `rejected`, sem liberar o evento. A cliente vê a recusa e pode enviar uma nova solicitação explicitamente.
- Repetir o envio enquanto está pendente não duplica o pedido. Respostas de uma solicitação antiga não podem aprovar uma nova solicitação.

A cliente acompanha o status no painel. Vínculos antigos já liberados são preservados. A cerimonialista continua sem permissão para editar dados ou consultar tokens individuais dos convidados.

## Recuperação de senha

No modo manual, “Esqueci minha senha” cria um pedido para a equipe. A aprovação emite um link de uso único, válido por 30 minutos, para o titular definir uma nova senha. Esse fluxo de recuperação é separado da aprovação de uma conta nova.

No modo de e-mail, `esqueci-senha.html` solicita o envio. A resposta é genérica para não informar se existe uma conta. Para uma conta elegível, a mensagem contém um token com 30 minutos de validade. `redefinir-senha.html` envia a nova senha. O servidor consome o token, troca o hash, confirma a posse do e-mail e invalida as sessões e tokens de confirmação anteriores. A pessoa entra novamente. Há também um aviso por e-mail após a troca.

## Convidado e confirmação de presença

O organizador cria um convidado e compartilha o link individual. O link leva o evento e o token do convidado. A página consulta as informações permitidas e envia a resposta à API. O servidor confere token, prazo e quantidade de pessoas. Crianças fazem parte do total de lugares. Se o convidado recusar, as reservas dele são liberadas.

O autocadastro público começa em `aprovacao`; o organizador precisa aprovar antes de permitir confirmação.

## Reserva de presente

Somente convidado confirmado, dentro do prazo, pode reservar. A atualização no banco exige que o presente ainda esteja livre. As alterações do evento usam bloqueio e transação para coordenar pedidos concorrentes. O convidado só pode cancelar a própria reserva.

## Exportação e WhatsApp

`painel.js` gera o CSV no navegador e usa a impressão do navegador para a opção de PDF. A ação de WhatsApp abre uma mensagem para compartilhamento manual. O código não envia mensagens automaticamente por uma API de WhatsApp e não cobra o valor dos presentes.
