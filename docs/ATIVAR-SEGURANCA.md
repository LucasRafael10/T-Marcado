# Ativar as melhorias de segurança — Tá Marcado

Código preparado sobre o GitHub `LucasRafael10/T-Marcado`, commit `4452d6b`. Ainda não instalado no Supabase, Render ou GitHub. Não sobrescreva mudanças posteriores sem comparar.

## Antes de publicar o código

1. Guarde backup do banco e a versão atual do código. As migrações abaixo não excluem contas nem eventos.
2. Confirme o domínio de envio na Resend e use um `EMAIL_FROM` desse domínio. O remetente de teste `onboarding@resend.dev` não atende clientes em geral: agora o cadastro depende do recebimento do e-mail. Mantenha `RESEND_API_KEY` somente no Render.
3. No Supabase, SQL Editor, execute **004_security.sql**, depois **005_runtime_role.sql**, da pasta `supabase/migrations`. As migrações 001, 002 e 003 já devem existir. Não repita as antigas para esta atualização.
4. Defina uma senha exclusiva e forte para `tamarcado_app` como administrador. Use um cliente PostgreSQL com o comando interativo `\password tamarcado_app`, que pede a senha sem colocá-la no arquivo. Alternativa no SQL Editor: `ALTER ROLE tamarcado_app PASSWORD 'SENHA_GERADA_POR_VOCE';` — substitua localmente, não publique nem compartilhe o comando preenchido. Não use literalmente esse exemplo. O SQL de migração não contém senha.
5. Na conexão Session pooler, preserve host, projeto, porta 5432 e nome do banco. Troque o usuário `postgres.ID_DO_PROJETO` por `tamarcado_app.ID_DO_PROJETO` e use a senha dessa nova role. Caracteres especiais da senha precisam de percent-encoding na URI. Guarde a URI completa em `DATABASE_URL` no Render, nunca no GitHub.
6. Configure `DATABASE_CA_CERT` no Render com a CA fornecida pelo Supabase, caso necessária para a cadeia do servidor. O valor é PEM, com quebras de linha reais ou `\n`. Certificados de CA são públicos; senhas, URI e API keys são secretos. Nunca contorne erro de certificado desativando a validação.
7. Mantenha `NODE_ENV=production` e confira `APP_ORIGIN` (ou `RENDER_EXTERNAL_URL`) com a URL HTTPS pública, sem barra final.
8. Depois das migrações e variáveis, copie o conteúdo do projeto para o repositório, faça commit/push e acompanhe o deploy. Não envie o ZIP fechado. O processo de migração deve usar conta administrativa separada; o servidor exige `tamarcado_app` em produção. O script `npm run db:migrate` prepara 001–004; 005 é administrativa e manual.

## Efeito nas contas atuais

Todas as contas existentes ficam com e-mail não confirmado na primeira execução da migração 004. Sessões dessas contas param de dar acesso quando o código novo entra. Use **Reenviar confirmação** na tela de login para confirmar o e-mail e definir uma senha pessoal; **Esqueci minha senha** também confirma a posse do endereço ao concluir a troca. Eventos e convidados permanecem salvos. Reexecutar 004 não desfaz confirmações já feitas.

O cerimonialista recebe um link para escolher sua senha; o organizador não define nem vê essa senha. Uma conta de cerimonialista já confirmada continua usando sua própria senha.

## Conferência após o deploy

- `/health` responde `ok`.
- Cadastro não abre o painel antes de confirmar o e-mail.
- Mensagem chega a um destinatário autorizado pelo domínio Resend.
- Link permite definir senha e entrar; tentar reutilizá-lo falha.
- Recuperação permite entrar com a nova senha e invalida sessões antigas.
- Organizador não vê eventos alheios; cerimonialista tem leitura dos eventos autorizados.
- Se houver erro `42501`, confira a migração 005 e o usuário da conexão. Se houver erro TLS, confira a CA e o host; não desative a verificação.

## Limites da proteção entregue

A role só tem operações de dados nas nove tabelas da aplicação, sem administração, DDL ou bypass de RLS. A política dessa role permite os dados do servidor; isolamento por organizador continua sendo validado pela API, não por identidade individual no banco. Um comprometimento do servidor ainda pode atingir os dados dessas tabelas.

As tentativas usam contadores atômicos compartilhados no PostgreSQL, expiram e são limpos periodicamente. Não confiamos em `X-Forwarded-For` enviado pelo cliente. Se o proxy apresentar o mesmo IP para vários visitantes, eles dividem limites; há limites adicionais por e-mail no login, recuperação e reenvio. Validar a cadeia de proxies permite refinar isso futuramente. Não é proteção contra DDoS volumétrico; essa camada depende da infraestrutura.

Envios são assíncronos, sem fila durável. Se houver reinício no momento do envio, o usuário pode pedir outro link. Falhas da Resend são registradas sem tokens ou chaves. Links têm validade de 30 minutos, uso único e apenas seu hash fica no banco.

Verificação final: 19 testes passaram, incluindo uso único e expiração, isolamento entre contas, limites compartilhados, CSP, corpo UTF-8 e proibição de DDL para a role restrita.

Testes locais usam PostgreSQL embutido (PGlite) e simulação da Resend. Não validam a CA, entrega real de e-mail, senha da role ou configuração da sua conta Supabase. A implantação precisa das verificações acima. Segurança absoluta não pode ser garantida.

Referências: https://supabase.com/docs/guides/database/postgres/roles e https://supabase.com/docs/guides/database/connecting-to-postgres
