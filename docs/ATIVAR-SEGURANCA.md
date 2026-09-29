# Configuração do servidor e do banco

Este guia explica a configuração usada pelo código. Não é necessário repeti-la para atualizar somente a pasta `docs` ou o cadastro simplificado.

## Variáveis do Render

| Nome | Conteúdo | Para que serve |
| --- | --- | --- |
| `NODE_ENV` | `production` | Ativa as exigências de produção |
| `APP_ORIGIN` | URL HTTPS real, sem barra final | Define origem permitida e links enviados |
| `RENDER_EXTERNAL_URL` | Definida pelo Render | Alternativa automática quando APP_ORIGIN não existe |
| `DATABASE_URL` | URI real do banco com a role `tamarcado_app` | Conecta ao PostgreSQL |
| `DATABASE_CA_CERT` | Certificado CA em texto PEM, se necessário | Valida a cadeia TLS do banco |
| `RESEND_API_KEY` | Chave real da Resend | Autoriza envio |
| `EMAIL_FROM` | Remetente autorizado | Identifica quem envia |
| `PORT` | Porta fornecida pelo ambiente; padrão local 4173 | Endereço de escuta do servidor |

Chave de API e URI com senha são secretos. O certificado CA é público. O código aceita PEM com quebras de linha ou `\n` e nunca deve ser alterado para ignorar certificado inválido.

## Instalação nova

1. Prepare o PostgreSQL e aplique 001, 002, 003 e 004 na ordem.
2. Aplique 005 como administrador. Ela cria/configura a role `tamarcado_app` e suas permissões.
3. Defina uma senha forte exclusiva para essa role. A migração não traz senha pronta.
4. Copie a conexão Session pooler real do projeto. Preserve host, identificador, porta e banco. Use o usuário `tamarcado_app` com o identificador exigido pelo pooler e a senha dessa role. Não copie palavras como HOST ou SENHA_NOVA literalmente.
5. Configure variáveis e CA necessária no Render; configure envio na Resend.
6. Publique o código e confira o resultado do deploy, `/health` e os fluxos de conta.

A conta administrativa é usada para migrações. A conta `tamarcado_app` executa o site. Não tente aplicar alterações de estrutura com ela. O comando `npm run db:migrate` aplica 001–004; 005 permanece uma etapa administrativa manual.

## O que a migração 005 altera

Permite SELECT, INSERT, UPDATE e DELETE nas nove tabelas da aplicação e cria uma política RLS para a role do servidor. Não concede criação de tabelas, administração ou bypass de RLS. Também retira CREATE no schema `public` de PUBLIC: em um banco compartilhado com outros aplicativos, avalie o efeito sobre essas outras roles antes de aplicar.

## Problemas comuns

| Erro | Significado / próximo passo |
| --- | --- |
| `ENOTFOUND HOST` | Foi usado o marcador HOST; copie o endereço real do Supabase |
| `28P01` | Banco recusou autenticação; confira usuário e senha da role correta |
| `42501` | Falta permissão; confira role e migração 005 |
| Erro de certificado | Confira CA e host; mantenha validação TLS habilitada |
| Exige `tamarcado_app` | A conexão ainda usa outro usuário |
| `.env not found` no Render | Pode ser normal: as variáveis vêm do painel Environment |
| Host/origem inválida | Confira se APP_ORIGIN corresponde ao endereço acessado |

Fontes: [conexão PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres) e [roles](https://supabase.com/docs/guides/database/postgres/roles).
