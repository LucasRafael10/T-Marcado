# Configurar recuperação de senha com Resend

Este projeto usa autenticação própria em Node e tabelas PostgreSQL. O envio passa por src/email.mjs usando a API HTTPS da Resend; não precisa configurar SMTP no Supabase Auth. Já existem recuperação de senha e aviso após alteração. Verificação do e-mail no cadastro não está implementada.

## 1. Domínio e chave

1. Abra https://resend.com/domains e adicione um domínio que você controla. O endereço gratuito do Render não é um domínio seu para cadastrar no DNS da Resend.
2. No provedor DNS desse domínio, adicione exatamente os registros de envio indicados pela Resend, incluindo SPF e DKIM. Não remova registros de e-mail existentes e não ative recebimento para apenas enviar recuperação.
3. Aguarde o domínio aparecer como Verified. Use no EMAIL_FROM um endereço desse domínio ou subdomínio verificado.
4. Em https://resend.com/api-keys crie uma chave com permissão Sending access, restrita ao domínio quando possível. Guarde-a apenas no ambiente do servidor.
5. Mantenha rastreamento de cliques e aberturas desativado para recuperação de senha.

## 2. Ambiente do servidor

No serviço web do Render, em Environment, cadastre:

| Variável | Valor |
| --- | --- |
| RESEND_API_KEY | Sua chave real, cadastrada diretamente no Render |
| EMAIL_FROM | Gêmeas Cerimonial <nao-responda@seu-dominio.com.br> |
| APP_ORIGIN | URL exata que você abre no navegador, com https e sem barra final |
| DATABASE_URL | Conexão PostgreSQL existente |
| NODE_ENV | production |

Os valores acima são exemplos. No painel não coloque aspas ao redor dos valores. Salve e faça novo deploy. O render.yaml revisado solicita as variáveis; alterar esse arquivo não garante atualização de um serviço já criado manualmente.

Para teste restrito, o remetente onboarding@resend.dev só permite enviar ao endereço da sua conta Resend. Esse mesmo endereço precisa ter uma conta cadastrada no site. Para outros destinatários, use seu domínio verificado.

## 3. Banco de dados

A tabela password_resets precisa existir. Com DATABASE_URL configurada no seu ambiente de administração, execute `npm run db:migrate`, ou aplique supabase/migrations/002_password_reset.sql no editor SQL do banco já existente. O comando aplica também as migrações 001 e 003. Faça backup antes de alterar o banco de produção. O deploy não executa migrações automaticamente.

## 4. Conferência ponta a ponta

1. Cadastre uma conta de teste no site com e-mail que você controla.
2. Abra /esqueci-senha.html e solicite a recuperação.
3. Confira Emails/Logs na Resend e a caixa de entrada/spam. A resposta genérica do site protege a existência das contas; ela não comprova entrega.
4. Abra o link e defina uma senha com pelo menos 8 caracteres.
5. Verifique que a senha antiga e as sessões anteriores não funcionam, a nova senha funciona e o link usado é rejeitado.
6. Confira o aviso de senha alterada. Pedidos repetidos para a mesma conta têm intervalo mínimo de 60 segundos.

## Diagnóstico

- 503 no site: chave ou remetente ausente no servidor.
- Resend HTTP 401/403 nos logs: confira chave, permissão, domínio e destinatário permitido no modo de teste.
- HTTP 422: confira campos e remetente.
- HTTP 429: quota ou frequência excedida.
- Resposta genérica sem registro na Resend: conta inexistente, intervalo de 60 segundos ou falha de processamento/banco; confira logs do servidor e migração 002.
- Link aponta para outro site ou erro de origem/host: corrija APP_ORIGIN.
- E-mail aceito pela API não significa entrega à caixa de entrada; confira status e eventuais rejeições no painel.

Não coloque a chave em HTML, JavaScript público ou GitHub. Não envie a chave em conversa ou captura de tela.

## Fontes oficiais consultadas

https://resend.com/docs/dashboard/domains/introduction
https://resend.com/docs/dashboard/api-keys/introduction
https://resend.com/docs/api-reference/errors
