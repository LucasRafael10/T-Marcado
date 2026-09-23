> Revisão histórica. Para o estado atual e instalação, leia ATIVAR-SEGURANCA.md. A validação TLS foi corrigida nesta versão.

# Revisão do código — 22/09/2026

Escopo: leitura do servidor, autenticação, recuperação, configuração e testes existentes. Não é uma auditoria completa nem validação do ambiente publicado.

## Melhorias realizadas

- Diagnóstico de falhas Resend por status HTTP e timeout, sem registrar conteúdo do e-mail, token ou chave.
- render.yaml com RESEND_API_KEY e EMAIL_FROM, e APP_ORIGIN configurável em vez de URL fixa de outro deploy.
- .env.example e .gitignore para configuração local sem versionar segredos.
- Testes do adaptador Resend e guia de configuração/validação.

## Proteções já presentes

Tokens aleatórios de recuperação com hash no banco, validade de 30 minutos, uso único e transação para trocar senha. Sessões antigas são revogadas. Resposta genérica para conta existente/inexistente. SQL parametrizado, cookie HttpOnly/SameSite, controle de origem e limite de solicitações.

## Pendências prioritárias

1. src/database.mjs usa rejectUnauthorized: false. A conexão é cifrada, mas não valida o certificado do servidor. Configurar CA confiável do provedor e ativar validação antes de produção; não alterado automaticamente para evitar interromper a conexão existente sem a cadeia de certificados.
2. src/password-reset.mjs envia em segundo plano, sem fila persistente. Reinício pode perder envio após a resposta ao navegador. Para entrega resiliente, implementar outbox no banco com worker, tentativas limitadas e idempotência.
3. src/api.mjs limita tentativas usando req.socket.remoteAddress e memória local. Atrás do proxy Render usuários podem compartilhar limite; múltiplas instâncias não compartilham contadores. Validar a cadeia de proxies antes de confiar em headers e usar armazenamento compartilhado se escalar.
4. Cadastro não confirma posse do e-mail. Recuperação não substitui verificação de cadastro. Adicionar fluxo independente com token e estado email_verified se necessário.
5. src/passwords.mjs usa scryptSync; sob carga, cálculo bloqueia o servidor. Migrar para scrypt assíncrono com controle de concorrência.
6. A CSP permite script unsafe-inline. Remover scripts inline antes de endurecer a política.

Não foram alterados visual, gestão de eventos ou banco de produção. Nenhuma conta externa foi configurada e nenhum e-mail real foi enviado nesta revisão.

## Validação executada

`npm test`: 14 testes aprovados, zero falhas. PostgreSQL embutido PGlite e Resend simulada; cobre recuperação, expiração, uso único, revogação de sessões, falha de envio e regressões da API. Não comprova entrega de e-mail real nem comportamento do proxy de produção.
