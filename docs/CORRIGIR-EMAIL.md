# Correção do envio de confirmação — 29/09/2026

## O que foi encontrado

No pacote anterior, o cadastro e o reenvio autenticado respondiam antes da conclusão do pedido à Resend. A página não recebia o erro do provedor, e um pedido dentro de 60 segundos era ignorado sem explicar o intervalo. Isso impedia distinguir uma tentativa de um envio aceito.

As capturas enviadas mostram um envio anterior como Delivered, a conta ainda não confirmada (email_verified=false) e logs de inicialização do Render. Esses registros não identificam a causa da tentativa mais recente. Não foi acessado o painel privado da Resend, do Render ou o banco de produção.

## Como instalar

1. Extraia o ZIP atualizado. Ele contém somente arquivos de atualização, inclusive os ajustes anteriores do cadastro.
2. No repositório do Tá Marcado, copie as pastas public, src, tests e docs para a raiz, substituindo os arquivos de mesmo caminho. Não apague as pastas existentes. Envie todas as alterações em um único commit.
3. Aguarde o deploy do Render ficar Live. Atualize a página com Ctrl+F5, entre com o e-mail e a senha já cadastrados e clique em Reenviar link quando disponível.

Não é necessário executar SQL ou instalar dependências novas para esta correção. Não marque email_verified=true manualmente: isso pula a verificação de propriedade do e-mail.

Base: pacote de cadastro de 29/09/2026, preparado anteriormente sobre o commit 15db510, e pacote de segurança anterior. Se houve outras mudanças nos mesmos arquivos, compare antes de substituir. Não é uma cópia obtida do GitHub atual nem um deploy já realizado.

## O que mudou

- Cadastro, login de conta pendente e reenvio da sessão aguardam o resultado do envio.
- A tela distingue envio aceito, falha e intervalo mínimo de um minuto.
- A conta e a senha continuam salvas quando o provedor falha; a pessoa pode reenviar sem repetir o cadastro.
- Um reenvio rejeitado preserva o token anterior, sem sobrescrever tokens mais novos ou recriar um token já consumido.
- O botão fica bloqueado enquanto a solicitação está em andamento e usa o prazo calculado pelo servidor, inclusive ao atualizar a página.
- Os logs de confirmação usam o prefixo [email-verification], sem imprimir endereço, senha, token ou chave de API.
- Os endpoints públicos que recebem apenas um endereço continuam com resposta genérica para não revelar contas. O detalhe de envio é restrito ao cadastro recém-criado ou a uma sessão autenticada.

Envio aceito não é uma verificação da caixa de entrada. O código confirma a resposta HTTP da API de envio; o resultado posterior precisa ser conferido no painel do provedor. Uma queda de rede pode deixar o resultado incerto; não há reenvio automático ilimitado nem garantia de entrega.

## Se ainda não chegar

Abra Render > serviço Tá Marcado > Logs. Entre na conta pendente e clique uma vez em Reenviar link. Observe as novas linhas, especialmente as que começam com [email-verification].

- Resend HTTP 401: confira RESEND_API_KEY.
- Resend HTTP 403: confira permissão da chave, domínio do remetente e restrição do remetente de teste.
- Resend HTTP 422: confira o remetente e os campos do e-mail.
- Resend HTTP 429: confira limites e quota de envio.
- Tempo de resposta excedido: confira a tentativa no painel Resend antes de reenviar.
- Falha ao preparar envio: confira as variáveis de e-mail e a conexão/permissões do banco.
- Envio aceito pela Resend: procure a tentativa com o mesmo horário no painel Emails da mesma conta/equipe. Confira destinatário, status, spam, lixeira e filtros do Gmail.

Variáveis relevantes no Render: RESEND_API_KEY, EMAIL_FROM e APP_ORIGIN. APP_ORIGIN deve ser https://tamarcado.onrender.com, sem barra final. O remetente precisa seguir as condições da conta Resend. Não envie as chaves secretas por mensagem.

A mensagem '.env not found. Continuing without it.' sozinha não comprova falta de configuração: este comando permite usar as variáveis do ambiente sem um arquivo .env.

Se precisar de ajuda após aplicar, envie apenas as linhas de diagnóstico geradas no horário do clique e o status dessa tentativa na Resend, ocultando dados pessoais e segredos. Logs apenas do início do deploy não mostram o resultado do envio.

## Validação executada

24 testes passaram, considerando a suíte de 23 testes e o teste adicional de interface executado na suíte de 4 testes da interface. Foram simulados envio aceito, HTTP 403/429, espera do provedor, intervalo, ausência de configuração, preservação do token anterior, senha preservada e bloqueio de cliques duplicados. A API foi testada com PostgreSQL embutido PGlite; a interface foi testada com DOM simulado.

Nenhum e-mail real foi enviado, nenhuma conta real foi criada e nenhum deploy foi realizado. A entrega real depende da implantação e da configuração do provedor. O teste não substitui a conferência em produção.

Referência da API de envio: https://resend.com/docs/api-reference/emails/send-email
Configuração de domínio/remetente: https://resend.com/docs/dashboard/emails/introduction
