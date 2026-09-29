# Mapa do código

Todos os caminhos abaixo começam na raiz do projeto, onde está `package.json`.

## Arquivos principais

| Caminho | Para que serve |
| --- | --- |
| `server.mjs` | Inicia o site, atende páginas, aplica cabeçalhos de segurança e encaminha pedidos da API |
| `package.json` | Declara dependências, versão mínima do Node e comandos de execução |
| `package-lock.json` | Registra as versões resolvidas das dependências para instalações consistentes |
| `render.yaml` | Modelo de configuração para implantação; não substitui automaticamente as configurações de um serviço criado manualmente |
| `README.md` | Apresentação geral na raiz; use `docs/README.md` como índice deste guia atualizado |
| `docs/` | Explicações; não é a aplicação |

## Páginas: public/

| Arquivo | O que a pessoa faz nele |
| --- | --- |
| `index.html` | Conhece o serviço e preenche o cadastro do organizador/evento |
| `login.html` | Entra como organizador ou cerimonialista |
| `aguarde-confirmacao.html` | Aguarda confirmação sem repetir o e-mail; permite reenvio opcional |
| `confirmar-email.html` | Confirma o cadastro; no convite de cerimonialista, permite escolher a senha |
| `reenviar-confirmacao.html` | Solicita outro link informando um e-mail, quando necessário |
| `esqueci-senha.html` | Solicita recuperação de senha |
| `redefinir-senha.html` | Define uma senha nova com o link de recuperação |
| `painel.html` | Gerencia evento, convidados, presentes, convites e acesso do cerimonialista |
| `cerimonialista.html` | Consulta os eventos autorizados |
| `convite.html` | Mostra o convite e permite responder ou reservar presentes |
| `logo-mark.svg` | Símbolo do site |
| `favicon.svg` | Ícone da aba do navegador |

## Comportamento das telas: public/js/

| Arquivo | Responsabilidade |
| --- | --- |
| `app.js` | Funções compartilhadas: chamadas à API, mensagens, janelas, formatação e escape de textos |
| `main.js` | Abre o cadastro, envia os campos e leva à espera de confirmação |
| `password-feedback.js` | Atualiza a barra de força estimada e o aviso de senhas iguais |
| `login.js` | Escolhe o perfil e envia o login; trata conta ainda não confirmada |
| `wait-verification.js` | Consulta a confirmação a cada 5 segundos e abre o painel; reenvia sem pedir o e-mail |
| `confirm-verification.js` | Lê o token do link, confirma e redireciona; trata o convite de cerimonialista |
| `recovery.js` | Formulários de recuperação, redefinição e reenvio por e-mail |
| `painel.js` | Lista, filtra e altera dados do evento; gera CSV e abre impressão/WhatsApp |
| `cerimonialista.js` | Lista eventos e detalhes disponíveis em modo de leitura |
| `convite.js` | Controla etapas do convite, quantidade de pessoas, resposta e presentes |

O nome `main.js` não significa que todo o sistema esteja nele. Ele cuida da página inicial. `app.js` é compartilhado pelas páginas que o carregam.

## Aparência: public/css/

| Arquivo | Uso principal |
| --- | --- |
| `tokens.css` | Variáveis de cores e fontes usadas pelos demais estilos |
| `base.css` | Estilos comuns; também contém o indicador de senha |
| `components.css` | Componentes reutilizáveis |
| `style.css` | Página inicial |
| `login.css` | Tela de entrada e elementos aproveitados pelas páginas de conta |
| `painel.css` | Painel do organizador |
| `cerimonialista.css` | Painel de consulta |
| `convite.css` | Convite público |
| `recovery.css` | Páginas de recuperação, confirmação e espera |
| `refinements.css` | Ajustes visuais complementares |

Cada HTML informa quais CSS carrega. A ordem importa: uma regra carregada depois pode prevalecer sobre outra. Consulte os `<link rel="stylesheet">` da página antes de editar.

## Regras do servidor: src/

| Arquivo | Responsabilidade | Funções que ajudam a começar a leitura |
| --- | --- | --- |
| `config.mjs` | Porta, endereço público e cookie HTTPS | `port`, `appOrigin`, `secureCookie` |
| `api.mjs` | Recebe campos, escolhe a operação e aplica regras de negócio | `api`, `route`, `body` |
| `auth.mjs` | Identifica a pessoa e confere acesso | `session`, `auth`, `allowed`, `guestAuth`, `loginCookie`, `pendingSession` |
| `database.mjs` | Conecta ao PostgreSQL e executa consultas/transações | `get`, `all`, `run`, `transaction` |
| `repository.mjs` | Cria registros básicos | `user`, `event`, `guest` |
| `validation.mjs` | Valida texto, telefone, inteiro, data e prazo | `txt`, `phone`, `integer`, `date`, `deadline`, `fail` |
| `passwords.mjs` | Gera IDs, cria e confere hashes de senha | `id`, `hash`, `verify` |
| `email-verification.mjs` | Gera, envia e consome links de confirmação | `requestVerification`, `sendVerification`, `verificationInfo`, `confirmEmail` |
| `password-reset.mjs` | Recuperação e troca de senha | `requestReset`, `resetPassword` |
| `email.mjs` | Chama a Resend e resume falhas de envio | `sendEmail`, `emailDiagnostic` |
| `email-templates.mjs` | HTML e aparência dos e-mails | `layout`, `resetEmailHtml`, `verificationEmailHtml` |
| `rate-limit.mjs` | Conta tentativas no banco e recusa excesso | `consume`, `limit`, `cleanRates` |

`get` devolve uma linha; `all` devolve uma lista; `run` executa uma alteração. `transaction` mantém operações relacionadas juntas: se uma falhar, o conjunto é revertido.

## Estrutura do banco, scripts e testes

| Caminho | Função |
| --- | --- |
| `supabase/migrations/001_initial.sql` | Contas, sessões, eventos, acessos, convidados e presentes |
| `supabase/migrations/002_password_reset.sql` | Recuperação de senha |
| `supabase/migrations/003_invite_options.sql` | Cor, imagem, dress code, press kit e endereço |
| `supabase/migrations/004_security.sql` | Confirmação de e-mail e limites de tentativas |
| `supabase/migrations/005_runtime_role.sql` | Conta de execução do servidor com privilégios reduzidos |
| `scripts/migrate.mjs` | Aplica 001 a 004 usando uma conexão administrativa; não aplica 005 |
| `scripts/preview.mjs` | Demonstração local com dados temporários; veja a limitação em VALIDACAO.md |
| `tests/integration.test.mjs` | Fluxos HTTP, banco e permissões |
| `tests/email.test.mjs` | Modelos de e-mail e adaptador Resend |
| `tests/signup-ui.test.mjs` | Lógica da barra, confirmação e redirecionamento com DOM simulado |
