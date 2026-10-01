# Banco de dados, explicado sem complicação

O projeto usa PostgreSQL no Supabase. A autenticação é própria: as telas falam com o servidor Node, e o servidor consulta as tabelas. O cadastro não usa Supabase Auth.

## As nove tabelas

| Tabela | O que guarda | Relação principal |
| --- | --- | --- |
| `users` | Nome, e-mail único, hash da senha, perfil e confirmação do e-mail | Uma conta pode organizar eventos |
| `sessions` | Token de sessão, usuário e vencimento | Pertence a `users` |
| `events` | Título, tipo, data, local, prazo e personalização | `owner` aponta para `users` |
| `access` | Acesso de leitura após aceite da cerimonialista (ou vínculo anterior preservado) | Liga `users` a `events` |
| `planner_requests` | Pedido pendente, aceito ou recusado; datas de envio e resposta | Liga evento à cerimonialista destinatária |
| `guests` | Dados do convidado, token, limite, resposta e endereço opcional | Pertence a `events` |
| `gifts` | Presente, valor de referência e reserva | Pertence a `events`; reserva aponta para `guests` |
| `password_resets` | Hash e validade do link de recuperação | Um registro por usuário |
| `email_verifications` | Hash e validade do link de confirmação | Um registro por usuário |
| `rate_limits` | Contador e vencimento de tentativas | Chave derivada da operação e do identificador usado no limite |

IDs e tokens de convidados/sessões usam 18 bytes aleatórios, escritos como 36 caracteres hexadecimais. Tokens de e-mail usam 32 bytes, escritos como 64 caracteres; apenas seu hash vai para as tabelas de confirmação e recuperação.

As datas do evento e do prazo são textos no formato `AAAA-MM-DD`. O servidor valida a existência da data. Validades de sessões e tokens usam números em milissegundos. Valores de presentes usam `numeric(12,2)`.

## Regras importantes

- E-mail é armazenado em minúsculas e não pode repetir em `users`.
- Telefone não pode repetir dentro do mesmo evento; pode existir em eventos diferentes.
- `pendente`: ainda não respondeu; `aprovacao`: aguarda organizador; `confirmado`: aceitou; `recusado`: não irá.
- `lugares` é o total de pessoas, incluindo `criancas`.
- O prazo considera `America/Cuiaba`.
- A reserva deve apontar para um convidado do mesmo evento.
- Sessão dura 24 horas; link de confirmação/recuperação dura 30 minutos.

## Permissões do banco

`tamarcado_app` é a conta de execução do servidor. A migração 005 concede operações de dados nas nove tabelas, mas não administração nem alteração da estrutura. Ela não deve ser proprietária das tabelas. O servidor exige esse nome em produção.

RLS é a proteção de acesso por linhas do PostgreSQL. Neste projeto, o público (`anon` e `authenticated`) não recebe acesso às tabelas. A conta do servidor possui uma política própria que permite suas operações; a separação entre organizadores é feita por `auth.mjs` e `api.mjs`. RLS não identifica individualmente cada organizador nesse modelo.

## Quando executar SQL

Só quando uma atualização trouxer mudança de estrutura. Não execute migrações novamente para trocar textos, cores ou esta documentação. A atualização do cadastro simplificado não adiciona tabela nem coluna.

Em instalação nova, a sequência é 001, 002, 003, 004 e 005. Use uma conta administrativa para aplicar migrações; `tamarcado_app` é para executar a aplicação. A primeira aplicação de 004 marca contas existentes como não confirmadas; repetir 004 não desfaz confirmações já gravadas.
