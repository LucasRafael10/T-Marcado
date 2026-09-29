# Como o sistema funciona, passo a passo

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

## Convite do cerimonialista

O organizador informa nome e e-mail em seu painel. O servidor confere que ele é dono do evento e cria a ligação na tabela `access`. Se a conta do cerimonialista for nova, recebe um segredo aleatório que não é entregue ao organizador e um link para definir a própria senha. Nesse caso existe escolha de senha na ativação, porque o cerimonialista não participou do cadastro inicial. Uma conta já confirmada mantém a senha existente.

## Recuperação de senha

`esqueci-senha.html` solicita o envio. A resposta é genérica para não informar se existe uma conta. Para uma conta elegível, a mensagem contém um token com 30 minutos de validade. `redefinir-senha.html` envia a nova senha. O servidor consome o token, troca o hash, confirma a posse do e-mail e invalida as sessões e tokens de confirmação anteriores. A pessoa entra novamente. Há também um aviso por e-mail após a troca.

## Convidado e confirmação de presença

O organizador cria um convidado e compartilha o link individual. O link leva o evento e o token do convidado. A página consulta as informações permitidas e envia a resposta à API. O servidor confere token, prazo e quantidade de pessoas. Crianças fazem parte do total de lugares. Se o convidado recusar, as reservas dele são liberadas.

O autocadastro público começa em `aprovacao`; o organizador precisa aprovar antes de permitir confirmação.

## Reserva de presente

Somente convidado confirmado, dentro do prazo, pode reservar. A atualização no banco exige que o presente ainda esteja livre. As alterações do evento usam bloqueio e transação para coordenar pedidos concorrentes. O convidado só pode cancelar a própria reserva.

## Exportação e WhatsApp

`painel.js` gera o CSV no navegador e usa a impressão do navegador para a opção de PDF. A ação de WhatsApp abre uma mensagem para compartilhamento manual. O código não envia mensagens automaticamente por uma API de WhatsApp e não cobra o valor dos presentes.
