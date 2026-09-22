# Ativar as proteções no Render e Supabase

Esta alteração foi testada localmente; não foi aplicada ao banco nem ao Render. Não faça merge antes de preparar os itens abaixo. Guarde um backup do banco e a identificação do deploy atual.

## 1. Preparar entrega de e-mail

Configure RESEND_API_KEY da conta Tá Marcado e EMAIL_FROM com um remetente de domínio verificado no Resend. O remetente de teste onboarding@resend.dev não atende cadastro de clientes: ele restringe os destinatários à conta de teste. O Gmail da empresa pode ser usado para administrar as contas, mas não como domínio remetente verificado no Resend.

Confirme APP_ORIGIN com a URL HTTPS real do site. Teste a entrega no Resend antes de exigir confirmação de todos os usuários. Nunca publique a chave no GitHub.

## 2. Preparar o banco

No SQL Editor do Supabase, como administrador, execute as migrações ainda pendentes em ordem (001 a 004). Em um projeto que já possui as três primeiras, execute somente `supabase/migrations/004_account_security.sql`.

A migração mantém os dados e cria email_verified=false para contas existentes. Depois da nova versão, essas contas e colaboradores precisam confirmar e-mail ou concluir a recuperação de senha; sessões não verificadas deixam de funcionar. Reexecutar a migração não desfaz confirmações já realizadas.

Execute `supabase/setup_app_role.sql`. Ele cria tamarcado_app sem login e concede somente as operações utilizadas pelo servidor. A revogação de CREATE do schema public para PUBLIC também afeta outros usuários desse schema: caso compartilhe o projeto com outras aplicações, revise suas permissões antes.

Por uma conexão administrativa segura, defina uma senha exclusiva e habilite o login do papel. Não coloque a senha real em arquivos versionados, prints ou conversas. Execute também:

```sql
GRANT CONNECT ON DATABASE postgres TO tamarcado_app;
```

O papel precisa de LOGIN e senha antes de testar a conexão. Não dê a ele SUPERUSER, BYPASSRLS, propriedade das tabelas, CREATE ou associação a papéis administrativos. Migrações futuras continuam sendo executadas pela conexão de administrador, nunca pela conta do servidor.

## 3. Configurar o Render

- DATABASE_URL: use a conexão do Session pooler do mesmo projeto, trocando o usuário por `tamarcado_app.<referência-do-projeto>` e usando a senha desse papel. Preserve host, porta e banco fornecidos pelo Supabase. Codifique caracteres especiais da senha para URI.
- DATABASE_CA_CERT: certificado PEM da CA do projeto, baixado nas configurações SSL do banco. Inclua BEGIN/END CERTIFICATE; quebras de linha reais ou sequência literal \n são aceitas.
- APP_ORIGIN: URL HTTPS pública do site, sem barra no final.
- RESEND_API_KEY e EMAIL_FROM: valores do passo 1.
- NODE_ENV: production.
- TRUST_PROXY_HOPS: mantenha 0 até verificar a cadeia de proxies e o tratamento de X-Forwarded-For. Só use outro número quando todo caminho até o servidor atravessar exatamente essa quantidade de proxies confiáveis, que saneiem/acrescentem o cabeçalho. Um valor incorreto permite falsificar o IP.

Com TRUST_PROXY_HOPS=0, os limites por IP podem ser compartilhados por clientes atrás do Render. Os limites por conta/token e globais já ficam no PostgreSQL e sobrevivem a reinícios; não dependem desse ajuste.

Faça primeiro um deploy de prévia desta branch com as variáveis preparadas, usando um banco de teste com as migrações. Valide a conexão restrita e os e-mails reais antes de fazer merge na main e publicar em produção. Evite apontar uma prévia para o banco de produção.

## 4. Validar após a publicação

1. Confira /health e logs sem erros de conexão/certificado.
2. Cadastre um endereço seu: não deve haver sessão antes da confirmação.
3. Abra o e-mail, defina/confirme a senha e entre. O mesmo link não deve funcionar novamente.
4. Teste uma conta anterior usando Reenviar confirmação ou Recuperar senha.
5. Teste inclusão de convidado, confirmação de presença e acesso de colaborador.
6. Confirme que Render está usando tamarcado_app, nunca postgres.

Se houver falha de certificado ou permissão, corrija CA/grants específicos; não desative TLS nem promova o papel a administrador. Em necessidade de reversão, restaure o deploy anterior com a configuração anterior guardada; não apague usuários nem tabelas. A versão antiga não garante as novas restrições de confirmação.
