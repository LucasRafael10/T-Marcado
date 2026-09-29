# E-mails: confirmação, convite e recuperação

O servidor chama a API da Resend por HTTPS. Não é necessário configurar SMTP do Supabase Auth: este projeto usa autenticação própria.

## O que cada arquivo faz

| Arquivo | Função |
| --- | --- |
| `src/email.mjs` | Faz o envio e produz diagnósticos sem expor chave/token |
| `src/email-templates.mjs` | Define o visual HTML das mensagens |
| `src/email-verification.mjs` | Escolhe destinatário, cria token e envia confirmação/ativação |
| `src/password-reset.mjs` | Envia recuperação e aviso de troca de senha |

As mensagens incluem HTML e texto simples. Ao alterar um texto, confira ambas as versões.

## Configuração necessária

`RESEND_API_KEY` contém a chave de envio. `EMAIL_FROM` contém o remetente autorizado. `APP_ORIGIN` define o endereço usado nos links; na ausência dele em produção, o código usa `RENDER_EXTERNAL_URL`.

Para destinatários reais, verifique um domínio que você controla na Resend e configure os registros DNS que ela indicar. O remetente precisa usar esse domínio autorizado. O endereço gratuito `onrender.com` não dá controle sobre o DNS desse domínio.

O remetente de teste `onboarding@resend.dev` restringe o envio ao e-mail da conta Resend. Não interprete sucesso nesse teste como envio liberado para todos os clientes. Não copie marcadores ou endereços de exemplo como configuração real.

## Se a mensagem não chegar

1. Confira entrada e spam.
2. Veja se há envio registrado na Resend e qual status ele possui.
3. Se não houver registro, confira os logs do Render no horário do pedido.
4. Confira se a conta existe, se o intervalo de um minuto passou e se a migração necessária está aplicada.

| Mensagem | O que conferir |
| --- | --- |
| Envio indisponível / 503 | Chave e remetente no ambiente do servidor |
| Resend HTTP 401 | Chave válida |
| Resend HTTP 403 | Permissão, domínio/remetente e destinatário permitido |
| Resend HTTP 422 | Campos da mensagem e remetente |
| Resend HTTP 429 | Quota ou frequência de envio |
| Link aponta ao site errado | `APP_ORIGIN` ou endereço automático do Render |
| Link inválido/expirado | Peça um novo; links duram 30 minutos e têm uso único |
| Link pede outro navegador | Abra o link original no navegador do cadastro |

Envio acontece em segundo plano, sem fila durável. Reinício durante o envio pode exigir novo pedido. A mensagem genérica de solicitação não garante entrega; o aceite da API da Resend também não garante chegada à caixa de entrada.

Documentação oficial: [domínios](https://resend.com/docs/dashboard/domains/introduction), [chaves](https://resend.com/docs/dashboard/api-keys/introduction) e [erros](https://resend.com/docs/api-reference/errors).
