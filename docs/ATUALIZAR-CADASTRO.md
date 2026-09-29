# Atualização do cadastro — 29/09/2026

Preparada sobre o commit 15db510 do repositório LucasRafael10/T-Marcado.

## Instalar

Extraia o ZIP e envie as pastas public, src, tests e docs para a raiz do repositório, preservando os caminhos e substituindo os arquivos correspondentes. Não apague as pastas atuais: este pacote contém somente os arquivos alterados, não o projeto inteiro. Faça um único commit com todos os arquivos para publicar o frontend e o servidor juntos. Não é necessário executar SQL nem alterar variáveis no Render para esta atualização.

O acesso de escrita ao GitHub não foi utilizado. As mudanças ainda precisam ser enviadas e implantadas. Se houver mudanças posteriores ao commit acima nos mesmos arquivos, compare antes de substituir.

## Comportamento

- Durante o cadastro, a barra estima senha fraca, moderada ou forte; o texto informa quando as senhas coincidem. A estimativa é local, sem enviar a senha a terceiros; não consulta listas de vazamentos e não é garantia de resistência a ataques.
- A senha é escolhida uma vez no cadastro e seu hash permanece igual após confirmar.
- O cadastro dispara o envio e abre uma página de espera. Não solicita que a pessoa digite novamente o e-mail. O reenvio é opcional e usa o e-mail da sessão, com intervalo de um minuto.
- A página de confirmação ativa a conta e abre o painel automaticamente. A página de espera também detecta a confirmação.
- Abra o link no mesmo navegador/perfil usado para cadastrar. Essa ligação impede que alguém cadastre o e-mail de outra pessoa com uma senha conhecida pelo atacante e consiga acesso após a vítima confirmar. Se abrir em outro navegador, copie o link original do e-mail para o navegador do cadastro. Se perdeu a sessão, entre com a senha original para retomar; a recuperação de senha continua disponível.
- A sessão anterior à confirmação não dá acesso a eventos. Ao confirmar, sessões diferentes da que apresentou o link são invalidadas.
- Cerimonialistas convidados não criaram uma senha no formulário de cadastro; apenas esses convites continuam pedindo a senha pessoal na ativação.
- Cadastro duplicado orienta entrar ou recuperar senha, sem substituir a senha já existente.

## Verificação

22 testes automatizados passaram: API, isolamento, cookies, senha original preservada, link de uso único, expiração, confirmação sem senha, bloqueio de outro navegador, força estimada e coincidência de senhas. Os testes de interface executam os scripts com um DOM simulado; a revisão visual em navegador ficou pendente por indisponibilidade do executável neste ambiente.

Depois do deploy Live, teste no computador e no celular: criar conta, conferir a barra, aguardar o e-mail, abrir o link no mesmo navegador e observar o painel. O envio depende da configuração existente da Resend; o remetente de teste continua sujeito às restrições da conta.
