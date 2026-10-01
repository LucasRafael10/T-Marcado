# Atualizar a aprovação e o vínculo com cerimonialistas

## Aplicar no site existente

1. No Supabase, abra **SQL Editor → New query**.
2. Copie todo o arquivo `supabase/migrations/007_planner_requests.sql`, cole e clique em **Run**. É um arquivo novo, depois do 006. Ele não apaga contas, eventos, convidados ou acessos antigos e pode ser executado novamente.
3. No Render, abra o serviço do Tá Marcado e use **Manual Deploy → Deploy latest commit**, se a atualização automática ainda não tiver ocorrido.
4. As variáveis `ADMIN_ACCOUNTS`, `ACCESS_APPROVAL_MODE=manual` e `DATABASE_URL` continuam as já configuradas. Não precisa gerar outras senhas de administrador.

A aplicação usa a conexão restrita `tamarcado_app` e não executa alterações de estrutura ao iniciar. Por isso o SQL precisa ser aplicado pelo responsável no Supabase. Se o código chegar antes do SQL, os eventos existentes continuam funcionando; apenas as solicitações ficam temporariamente indisponíveis.

## Como usar

1. A cerimonialista abre **Entrar → Cerimonialista → Criar conta de cerimonialista**, informa nome, e-mail e escolhe uma senha.
2. Um administrador aprova a conta. Ela já pode entrar com essa senha, sem receber ou abrir um link. Se estiver na tela de espera, ela abre o painel automaticamente em até cinco segundos.
3. A cliente informa **somente o e-mail** dessa cerimonialista. Pode fazer isso no cadastro do evento, no campo opcional, ou em **Sua cerimonialista → Enviar solicitação** no painel.
4. A cerimonialista abre **Solicitações de clientes** e escolhe **Aceitar cliente** ou **Recusar**. O nome/e-mail da cliente e o resumo do evento ajudam a reconhecer o pedido.
5. Depois do aceite, o evento aparece em **Seus eventos**, com detalhes, convidados, confirmações e presentes. O acesso continua sendo de consulta.
6. A cliente acompanha **Aguardando resposta**, **Aceita — acesso liberado** ou **Solicitação recusada** no próprio painel.

Uma conta de cliente ainda em análise só envia o pedido à fila visível quando a equipe a aprova. A recusa não libera dados do evento. As solicitações aparecem dentro do site; não dependem de envio de e-mail.

## Contas e vínculos anteriores

Contas já aprovadas e vínculos já liberados são preservados. Não é preciso aprovar tudo novamente.

Uma cerimonialista criada automaticamente pela versão antiga, que nunca chegou a escolher uma senha, deve usar **Esqueci minha senha** para definir a primeira senha pelo procedimento de recuperação já existente. O sistema não atribui senha pública nem permite substituir a senha de uma conta só por conhecer seu e-mail. Novas cerimonialistas sempre escolhem sua senha no próprio cadastro.

A recuperação de senha continua separada da aprovação de conta: o link de recuperação mantém a finalidade de comprovar a autorização para trocar uma senha. A aprovação de uma conta nova não gera esse link.

## Validação

`npm test` testa o cadastro, a aprovação sem link, o bloqueio antes do aceite, a recusa, o aceite simultâneo, a proteção contra outra cerimonialista, a senha original e as permissões do banco. Os testes usam dados fictícios e banco isolado.
