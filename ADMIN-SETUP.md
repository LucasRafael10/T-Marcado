# Painel dos três administradores

A interface fica em **`/admin.html`**. Este painel tem credenciais próprias, separadas das contas de clientes. Não existe cadastro público de administrador. O servidor só aceita os **três** e-mails e hashes configurados em `ADMIN_ACCOUNTS`; conhecer um desses e-mails ou criar uma conta de cliente com ele não dá acesso ao painel.

## Ativação no Supabase e Render

1. Faça um backup do banco. No SQL Editor do Supabase, execute **`supabase/migrations/006_admin_approvals.sql`** com a conta administradora do banco, depois das migrações anteriores (incluindo `005_runtime_role.sql`). A aplicação continua usando a conexão restrita `tamarcado_app`. Não troque `DATABASE_URL` pela conta administradora.
2. Em um computador confiável, na pasta do projeto, rode `npm run admin:setup`. Informe seu nome/e-mail e os nomes/e-mails dos dois sócios. O script gera três senhas aleatórias fortes e diferentes. Não utiliza Resend.
3. No Render → serviço do Tá Marcado → Environment, crie `ADMIN_ACCOUNTS` e cole o conteúdo **inteiro** de `admin-config.json`, sem aspas externas. Não publique esse arquivo nem as credenciais. Entregue a cada sócio somente a própria senha, por um canal privado. Guarde as senhas em um gerenciador e apague `admin-credentials.txt` depois.
4. Na mesma atualização do Render, configure `ACCESS_APPROVAL_MODE=manual`, confirme `APP_ORIGIN=https://tamarcado.onrender.com` (ou o endereço HTTPS real, sem barra final) e salve/reimplante.
5. Abra `https://tamarcado.onrender.com/admin.html`, entre com cada uma das três credenciais e faça o teste completo abaixo.

A ativação não exige domínio próprio nem e-mail transacional. Sem `ADMIN_ACCOUNTS`, o painel recusa acesso. O servidor se recusa a iniciar em modo manual sem os três administradores válidos. O padrão continua `email` até a configuração acima, para permitir a implantação do código antes da migração e das credenciais.

Execute a migração e ative o modo manual na mesma janela de manutenção, evitando novos cadastros durante essa troca. A migração preserva como aprovadas as contas que **já tinham confirmado o e-mail naquele momento**; as demais ficam pendentes. Contas existentes aprovadas continuam acessando sem uma nova análise. A migração pode ser repetida sem reaprovar contas recusadas. Ao reverter para o modo de e-mail, contas aprovadas apenas manualmente precisarão confirmar seu e-mail; aprovação manual não marca o endereço como verificado.

## Uso diário

- **Contas:** confira a identidade por contato conhecido. Aprove ou recuse com justificativa e sua senha administrativa. A aprovação libera o login com a senha que o cliente já escolheu. Novos cerimonialistas recebem um link para escolher a primeira senha, entregue pelo administrador após conferir a identidade.
- **Trocas de senha:** o usuário solicita em “Esqueci minha senha”. O pedido não altera a senha nem concede acesso. Após conferir a identidade, aprove e entregue o link individual ao titular. Cada link vale por **30 minutos**, funciona **uma vez**, e gerar outro invalida o anterior. A pessoa escolhe a senha; administradores não podem consultá-la. Ao concluir, todas as sessões de cliente dessa conta são encerradas.
- **Histórico:** registra autor, conta, ação, horário e justificativa. Não coloque senhas, documentos ou dados sensíveis na justificativa.
- Não confirme a identidade apenas porque alguém informou o e-mail. Use um canal que vocês já sabem pertencer ao titular. O painel não envia automaticamente mensagens ou notificações: acompanhem as filas e entreguem os links por um canal conhecido.
- Sessões administrativas expiram em **8 horas**. Use “Sair da conta” em dispositivos compartilhados. Cada decisão exige novamente sua senha. Muitas tentativas seguidas bloqueiam temporariamente novas tentativas.

## Recuperar ou substituir um administrador

A recuperação pública é exclusiva de clientes. Para trocar um sócio ou recuperar uma credencial administrativa, o responsável pelo Render atualiza `ADMIN_ACCOUNTS`, mantendo exatamente três entradas válidas. O script `npm run admin:setup` pode gerar novamente as três credenciais após os arquivos anteriores terem sido guardados/removidos; isso exige redistribuir as três senhas. Alterar o e-mail ou o hash de um administrador invalida suas sessões anteriores. Não envie segredos ao GitHub, ao chat ou em capturas de tela.

## Conferência após ativar

1. Cadastre uma conta de teste. Ela deve entrar em “aguardando aprovação” e não acessar eventos protegidos. Feche o navegador e entre novamente: a espera continua.
2. Na administração, aprove com identidade conferida, justificativa e senha. O cliente deve acessar usando a senha original.
3. Solicite “Esqueci minha senha”. Confira o pedido no painel, aprove e copie o link. Abra-o, escolha uma senha, entre novamente e confirme que reutilizar o link falha.
4. Acesse `/api/admin/accounts` em uma janela anônima: deve responder 401. Uma sessão comum também não deve ter acesso.

Testes locais: `npm ci` e `npm test`. Usam PostgreSQL em memória (PGlite), sem acessar o banco de produção nem enviar e-mails reais. O histórico de auditoria permite somente leitura e inserção para a role de execução; não exclusão/alteração.
