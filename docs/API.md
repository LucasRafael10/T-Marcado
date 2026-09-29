# API: os pedidos feitos pelas telas

API é a conversa entre navegador e servidor. `GET` consulta, `POST` executa uma ação e `PATCH` altera dados. Os caminhos abaixo já incluem `/api`.

Pedidos que não são GET exigem origem igual à configuração do site. Os campos chegam em JSON. Mesmo que o navegador tenha validado um formulário, o servidor valida novamente.

## Contas

| Método e endereço | Para que serve | Acesso |
| --- | --- | --- |
| `POST /api/register` | Cria organizador/evento e dispara confirmação | Público, com limite |
| `POST /api/login` | Confere senha e cria sessão | Público, com limite |
| `POST /api/logout` | Apaga a sessão apresentada | Cookie atual |
| `GET /api/me` | Devolve dados básicos da conta | Sessão e e-mail confirmado |
| `GET /api/verification-status` | Informa e-mail da sessão e se já confirmou | Sessão, inclusive pendente |
| `POST /api/verification-info` | Indica como tratar o link | Token válido; informa se o navegador corresponde |
| `POST /api/confirm-email` | Confirma conta | Token; organizador também precisa da sessão correspondente |
| `POST /api/resend-pending` | Reenvia sem preencher e-mail | Sessão atual |
| `POST /api/resend-verification` | Solicita reenvio informando e-mail | Público, com limite |
| `POST /api/forgot-password` | Solicita recuperação | Público, com limite |
| `POST /api/reset-password` | Troca senha e invalida sessões | Token de recuperação válido |

O cadastro recebe `nome`, `email`, `password`, `passwordConfirm`, `titulo`, `tipo`, `data`, `prazo` e `local`. Confirmação de organizador envia só `token`; convite de cerimonialista também envia `password` e `passwordConfirm`.

## Eventos e convidados

Nos caminhos, `{evento}`, `{convidado}` e `{presente}` são marcadores explicativos para os IDs reais, não palavras para copiar na URL.

| Método e endereço | Operação | Permissão |
| --- | --- | --- |
| `GET /api/events` | Lista eventos permitidos | Organizador ou cerimonialista autorizado |
| `PATCH /api/events/{evento}` | Edita evento e aparência | Dono do evento |
| `GET /api/events/{evento}/public` | Dados públicos e, com token, dados limitados do convidado | Público / token individual |
| `POST /api/events/{evento}/identify` | Confere nome do convite | Token individual |
| `POST /api/events/{evento}/self-register` | Solicita entrada na lista | Público; começa aguardando aprovação |
| `POST /api/events/{evento}/response` | Confirma ou recusa presença | Token válido e regras do evento |
| `POST /api/events/{evento}/guests` | Adiciona convidado | Dono |
| `PATCH /api/events/{evento}/guests/{convidado}` | Edita ou aprova convidado | Dono |
| `GET /api/events/{evento}/gifts` | Lista presentes disponíveis | Token individual |
| `POST /api/events/{evento}/gifts` | Adiciona presente | Dono |
| `POST /api/events/{evento}/reserve/{presente}` | Reserva ou cancela reserva própria | Token, presença confirmada e prazo |
| `POST /api/events/{evento}/access` | Concede leitura ao cerimonialista | Dono |

## Como interpretar uma falha

| Código | Significado comum |
| --- | --- |
| 400 | Campo ou link inválido |
| 401 | Login/sessão ausente ou credenciais incorretas |
| 403 | Origem, navegador ou permissão incompatível |
| 404 | Operação, arquivo ou convite não encontrado |
| 409 | Conflito: cadastro repetido, reserva ocupada ou prazo encerrado |
| 413 | Pedido grande demais |
| 429 | Tentativas acima do limite |
| 500 | Falha interna; examinar logs do servidor |
| 503 | Serviço de e-mail não configurado em operações que o exigem |

`GET /health` fica fora de `/api`. Ele executa uma consulta simples no banco e responde `ok`. Não comprova que a Resend entregou uma mensagem nem que todos os fluxos funcionam.
